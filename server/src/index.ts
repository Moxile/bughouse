import { createServer, IncomingMessage } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { ConnectionManager } from './net/ConnectionManager.js';
import { TokenBucket } from './net/RateLimiter.js';

// Per-IP throttles. Capacity = burst, refill = sustained rate per second.
// Hand-rolled (in-memory, single-machine) — fine for the current Fly setup.
const roomCreateLimiter = new TokenBucket(5, 1 / 10); // 5 burst, 1 per 10s
const wsUpgradeLimiter = new TokenBucket(20, 1);      // 20 burst, 1/s

// Trust the first hop for x-forwarded-for; Fly proxies set this.
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
}, 10 * 60 * 1000).unref();

const PORT = Number(process.env.PORT ?? 3000);
// When run via npm workspace scripts, cwd = the server package directory.
// CLIENT_DIST env var overrides for custom deployments.
const CLIENT_DIST = process.env.CLIENT_DIST
  ?? resolve(process.cwd(), '../client/dist');

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
    // File not found → serve index.html (SPA fallback).
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

const cm = new ConnectionManager();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/games') {
    const ip = clientIp(req);
    if (!roomCreateLimiter.take(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rate-limited' }));
      return;
    }
    const code = cm.createRoom();
    if (code === null) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server-full' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/games') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cm.listRooms()));
    return;
  }

  // Static files.
  const filePath = url.pathname === '/'
    ? join(CLIENT_DIST, 'index.html')
    : join(CLIENT_DIST, url.pathname);
  serveFile(filePath, res);
});

// Manual upgrade so we can enforce an Origin allowlist and rate-limit
// WS handshakes before allocating a WebSocket. maxPayload is far below
// ws's 100 MiB default — no legitimate client message exceeds ~1 KB.
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return false;
  if (origin === `https://${host}` || origin === `http://${host}`) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

server.on('upgrade', (req, socket, head) => {
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
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => cm.handleConnection(ws));

server.listen(PORT, () => {
  console.log(`Bughouse server running on http://localhost:${PORT}`);
});
