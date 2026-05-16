import { createServer, IncomingMessage } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { ConnectionManager } from './net/ConnectionManager.js';
import { Persistence } from './storage/Persistence.js';
import { TokenBucket } from './net/RateLimiter.js';
import { handleAuthRoutes, pruneAuthLimiters } from './net/httpRoutes.js';
import { resolveSession, parseCookies } from './auth/sessions.js';

// Per-IP throttles. Capacity = burst, refill = sustained rate per second.
const roomCreateLimiter = new TokenBucket(10, 1 / 5); // 10 burst, 1 per 5s
const wsUpgradeLimiter = new TokenBucket(20, 1);      // 20 burst, 1/s

function clientIp(req: IncomingMessage): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// Drop idle bucket entries periodically.
setInterval(() => {
  roomCreateLimiter.prune();
  wsUpgradeLimiter.prune();
  pruneAuthLimiters();
}, 10 * 60 * 1000).unref();

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = resolve(
  process.env.CLIENT_DIST ?? resolve(process.cwd(), '../client/dist'),
);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Applied to every HTTP response.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://accounts.google.com/gsi/ ws: wss:",
    "script-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; '),
};

function setSecurityHeaders(res: import('node:http').ServerResponse): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function serveFile(path: string, res: import('node:http').ServerResponse): void {
  try {
    const data = readFileSync(path);
    const ext = extname(path);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const data = readFileSync(join(CLIENT_DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return false;
  if (origin === `https://${host}` || origin === `http://${host}`) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

// Boot sequence: connect to Postgres (runs migrations), then start listening.
Persistence.connect(DATABASE_URL).then((db) => {
  console.log('[db] Postgres connected and migrations applied');
  const cm = new ConnectionManager(db);

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      db.close().finally(() => process.exit(0));
    });
  }

  const server = createServer(async (req, res) => {
    setSecurityHeaders(res);
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    // Auth, OAuth callback, leaderboard, user, and game-detail routes.
    if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/leaderboard') || url.pathname.match(/^\/api\/users\//) || url.pathname.match(/^\/api\/games\/[^/]+$/)) {
      // CSRF: reject cross-origin state-mutating requests (not OAuth start/callback GETs).
      if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !url.pathname.includes('/callback')) {
        const origin = (req.headers.origin as string | undefined) ?? '';
        const host = (req.headers.host as string | undefined) ?? '';
        if (!isAllowedOrigin(origin, host)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden' }));
          return;
        }
      }
      const handled = await handleAuthRoutes(req, res, db);
      if (handled) return;
    }

    if (req.method === 'POST' && url.pathname === '/api/games') {
      const ip = clientIp(req);
      if (!roomCreateLimiter.take(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'rate-limited' }));
        return;
      }

      let body: Record<string, unknown> = {};
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          req.on('error', reject);
        });
        if (raw) body = JSON.parse(raw);
      } catch { /* use defaults */ }

      const minutes = typeof body.minutes === 'number' ? Math.max(1, Math.min(5, Math.round(body.minutes))) : 5;
      const isPrivate = typeof body.isPrivate === 'boolean' ? body.isPrivate : false;
      const isRated = typeof body.isRated === 'boolean' ? body.isRated : true;
      const allowSimul = typeof body.allowSimul === 'boolean' ? body.allowSimul : false;
      const rr = body.ratingRange as { min?: unknown; max?: unknown } | undefined;
      const ratingRange = (rr && typeof rr.min === 'number' && typeof rr.max === 'number' && rr.min < rr.max)
        ? { min: Math.round(rr.min), max: Math.round(rr.max) }
        : null;

      const result = cm.createRoom({ minutes, isPrivate, isRated, ratingRange, allowSimul });
      if (result === null) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'server-full' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: result.code, ownerPlayerId: result.ownerPlayerId }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/games') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cm.listRooms()));
      return;
    }

    const requested = url.pathname === '/'
      ? join(CLIENT_DIST, 'index.html')
      : resolve(CLIENT_DIST, '.' + url.pathname);
    if (requested !== CLIENT_DIST && !requested.startsWith(CLIENT_DIST + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    serveFile(requested, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on('upgrade', async (req, socket, head) => {
    if (req.url !== '/ws') {
      socket.destroy();
      return;
    }
    const origin = (req.headers.origin as string | undefined) ?? '';
    const host = (req.headers.host as string | undefined) ?? '';
    if (!isAllowedOrigin(origin, host)) {
      socket.destroy();
      return;
    }
    if (!wsUpgradeLimiter.take(clientIp(req))) {
      socket.destroy();
      return;
    }

    // Resolve session from cookie — silently fall back to guest on failure.
    let userId: string | null = null;
    let displayName: string | null = null;
    let rating: number | null = null;
    try {
      const user = await resolveSession(req, db);
      if (user) { userId = user.id; displayName = user.username; rating = user.rating; }
    } catch {
      // Non-fatal: proceed as guest.
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, userId, displayName, rating);
    });
  });

  wss.on('connection', (ws: import('ws').WebSocket, _req: unknown, userId: string | null, displayName: string | null, rating: number | null) => {
    cm.handleConnection(ws, userId, displayName, rating);
  });

  server.listen(PORT, () => {
    console.log(`Bughouse server running on http://localhost:${PORT}`);
  });
}).catch((e) => {
  console.error('[db] Failed to connect:', e);
  process.exit(1);
});
