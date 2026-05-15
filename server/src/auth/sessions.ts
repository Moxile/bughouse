import type { IncomingMessage, ServerResponse } from 'node:http';
import { Persistence } from '../storage/Persistence.js';
import type { UserRow } from '../storage/Persistence.js';

const COOKIE_NAME = 'bh_sess';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...vs] = part.trim().split('=');
      return [k?.trim() ?? '', vs.join('=').trim()];
    }),
  );
}

export function getSessionToken(req: IncomingMessage): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] ?? null;
}

export function setSessionCookie(res: ServerResponse, token: string, isSecure: boolean): void {
  const expires = new Date(Date.now() + SESSION_TTL_MS).toUTCString();
  const secure = isSecure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax${secure}; Path=/; Expires=${expires}`,
  );
}

export function clearSessionCookie(res: ServerResponse, isSecure: boolean): void {
  const secure = isSecure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=0`,
  );
}

export async function resolveSession(
  req: IncomingMessage,
  db: Persistence,
): Promise<UserRow | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = await db.getSession(token);
  if (!session) return null;
  if (session.sessionExpiresAt < new Date()) return null;
  return session;
}

export function isSecureContext(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? '').split(':')[0];
  return host !== 'localhost' && host !== '127.0.0.1';
}

export function createSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}
