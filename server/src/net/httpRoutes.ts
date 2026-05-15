import type { IncomingMessage, ServerResponse } from 'node:http';
import { Persistence } from '../storage/Persistence.js';
import {
  resolveSession,
  clearSessionCookie,
  setSessionCookie,
  createSessionExpiry,
  isSecureContext,
} from '../auth/sessions.js';
import { PROVIDERS, startOAuth, handleOAuthCallback, verifyGoogleIdToken } from '../auth/oauth.js';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('invalid-json')); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Route dispatcher — called from index.ts request handler.
// Returns true if the request was handled.
// ---------------------------------------------------------------------------

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  db: Persistence,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const { method, pathname } = { method: req.method, pathname: url.pathname };
  const secure = isSecureContext(req);

  // GET /api/auth/me
  if (method === 'GET' && pathname === '/api/auth/me') {
    const user = await resolveSession(req, db);
    json(res, 200, {
      user: user
        ? { id: user.id, username: user.username, displayName: user.displayName, rating: user.rating, ratingGamesPlayed: user.ratingGamesPlayed }
        : null,
    });
    return true;
  }

  // POST /api/auth/logout
  if (method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = req.headers.cookie ?? '';
    const match = cookies.match(/bh_sess=([^;]+)/);
    if (match?.[1]) await db.deleteSession(match[1]);
    clearSessionCookie(res, secure);
    json(res, 200, { ok: true });
    return true;
  }

  // GET /api/auth/google  — start OAuth
  if (method === 'GET' && pathname === '/api/auth/google') {
    startOAuth(req, res, PROVIDERS.google);
    return true;
  }

  // GET /api/auth/google/callback
  if (method === 'GET' && pathname === '/api/auth/google/callback') {
    await handleOAuthCallback(req, res, PROVIDERS.google, db);
    return true;
  }

  // POST /api/auth/google/credential — GSI library credential (ID token) sign-in
  if (method === 'POST' && pathname === '/api/auth/google/credential') {
    let body: { credential?: unknown } = {};
    try { body = await readBody(req) as typeof body; } catch { json(res, 400, { error: 'bad-request' }); return true; }
    if (typeof body.credential !== 'string') { json(res, 400, { error: 'bad-request' }); return true; }

    const profile = await verifyGoogleIdToken(body.credential);
    if (!profile) { json(res, 401, { error: 'invalid-credential' }); return true; }

    try {
      const user = await db.upsertOAuthUser({ provider: 'google', ...profile });
      const token = await db.createSession({
        userId: user.id,
        expiresAt: createSessionExpiry(),
        userAgent: req.headers['user-agent'] ?? null,
        ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
          ?? req.socket.remoteAddress ?? null,
      });
      setSessionCookie(res, token, secure);
      json(res, 200, { ok: true });
    } catch (e) {
      console.error('[auth] credential sign-in error:', e);
      json(res, 500, { error: 'internal' });
    }
    return true;
  }

  // PATCH /api/users/me — update username
  if (method === 'PATCH' && pathname === '/api/users/me') {
    const user = await resolveSession(req, db);
    if (!user) { json(res, 401, { error: 'not-authenticated' }); return true; }
    let body: { username?: unknown } = {};
    try { body = await readBody(req) as typeof body; } catch { json(res, 400, { error: 'bad-request' }); return true; }
    if (typeof body.username !== 'string') { json(res, 400, { error: 'bad-request' }); return true; }
    const result = await db.updateUsername(user.id, body.username);
    json(res, result.ok ? 200 : 400, result);
    return true;
  }

  // GET /api/leaderboard
  if (method === 'GET' && pathname === '/api/leaderboard') {
    const users = await db.listLeaderboard(50);
    json(res, 200, users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      rating: u.rating,
      ratingGamesPlayed: u.ratingGamesPlayed,
    })));
    return true;
  }

  // GET /api/users/:id/rating-history
  const histMatch = pathname.match(/^\/api\/users\/([^/]+)\/rating-history$/);
  if (method === 'GET' && histMatch) {
    const history = await db.getRatingHistory(histMatch[1]!, 50);
    json(res, 200, history);
    return true;
  }

  return false;
}

export function pruneAuthLimiters(): void {
  // No limiters remaining after removing password auth.
}
