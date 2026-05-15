import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Persistence } from '../storage/Persistence.js';
import {
  setSessionCookie,
  isSecureContext,
  createSessionExpiry,
  parseCookies,
} from './sessions.js';

const STATE_COOKIE = 'bh_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

type Provider = {
  name: 'google';
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: () => string;
  clientSecret: () => string;
};

const GOOGLE: Provider = {
  name: 'google',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scope: 'openid email profile',
  clientId: () => process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: () => process.env.GOOGLE_CLIENT_SECRET ?? '',
};

export const PROVIDERS: Record<'google', Provider> = { google: GOOGLE };

// ---------------------------------------------------------------------------
// GSI credential (ID token) verification
// ---------------------------------------------------------------------------

type GoogleTokenInfo = {
  sub: string;
  email: string;
  email_verified: string;
  name: string;
  given_name?: string;
  aud: string;
  exp: string;
};

export async function verifyGoogleIdToken(credential: string): Promise<{
  providerUserId: string;
  email: string | null;
  displayName: string;
} | null> {
  const clientId = GOOGLE.clientId();
  if (!clientId) return null;

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!res.ok) return null;

  const info = await res.json() as GoogleTokenInfo;

  // Verify the token was issued for our app and is not expired.
  if (info.aud !== clientId) return null;
  if (Number(info.exp) < Math.floor(Date.now() / 1000)) return null;

  return {
    providerUserId: info.sub,
    email: info.email_verified === 'true' ? info.email : null,
    displayName: info.name ?? info.given_name ?? 'Player',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function publicUrl(req: IncomingMessage): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = req.headers.host ?? 'localhost:3000';
  const proto = isSecureContext(req) ? 'https' : 'http';
  return `${proto}://${host}`;
}

function callbackUrl(req: IncomingMessage, provider: Provider): string {
  return `${publicUrl(req)}/api/auth/${provider.name}/callback`;
}

function setStateCookie(res: ServerResponse, state: string, secure: boolean): void {
  const expires = new Date(Date.now() + STATE_TTL_MS).toUTCString();
  const s = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax${s}; Path=/; Expires=${expires}`);
}

function clearStateCookie(res: ServerResponse, secure: boolean): void {
  const s = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${STATE_COOKIE}=; HttpOnly; SameSite=Lax${s}; Path=/; Max-Age=0`);
}

// ---------------------------------------------------------------------------
// Start: redirect the browser to the provider's authorize URL
// ---------------------------------------------------------------------------

export function startOAuth(
  req: IncomingMessage,
  res: ServerResponse,
  provider: Provider,
): void {
  if (!provider.clientId()) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `${provider.name}-not-configured` }));
    return;
  }

  const state = randomBytes(16).toString('base64url');
  const secure = isSecureContext(req);
  setStateCookie(res, state, secure);

  const params = new URLSearchParams({
    client_id: provider.clientId(),
    redirect_uri: callbackUrl(req, provider),
    response_type: 'code',
    scope: provider.scope,
    state,
  });
  if (provider.name === 'google') params.set('access_type', 'online');

  res.writeHead(302, { Location: `${provider.authorizeUrl}?${params}` });
  res.end();
}

// ---------------------------------------------------------------------------
// Callback: exchange code, fetch profile, upsert user, set session
// ---------------------------------------------------------------------------

export async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
  provider: Provider,
  db: Persistence,
): Promise<void> {
  const secure = isSecureContext(req);
  const url = new URL(req.url ?? '/', `http://localhost`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const cookies = parseCookies(req.headers.cookie);
  const storedState = cookies[STATE_COOKIE];
  clearStateCookie(res, secure);

  if (error || !code || !state || state !== storedState) {
    res.writeHead(302, { Location: '/?auth_error=1' });
    res.end();
    return;
  }

  try {
    // Exchange code for access token.
    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(req, provider),
        client_id: provider.clientId(),
        client_secret: provider.clientSecret(),
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json() as { access_token: string };

    // Fetch user profile.
    const profileRes = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json() as Record<string, unknown>;

    const { providerUserId, email, displayName } = extractProfile(provider.name, profile);

    const user = await db.upsertOAuthUser({
      provider: provider.name,
      providerUserId,
      email,
      displayName,
    });

    const token = await db.createSession({
      userId: user.id,
      expiresAt: createSessionExpiry(),
      userAgent: req.headers['user-agent'] ?? null,
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? req.socket.remoteAddress
        ?? null,
    });
    setSessionCookie(res, token, secure);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (e) {
    console.error(`[oauth] ${provider.name} callback error:`, e);
    res.writeHead(302, { Location: '/?auth_error=1' });
    res.end();
  }
}

// ---------------------------------------------------------------------------
// Profile extraction per provider
// ---------------------------------------------------------------------------

function extractProfile(
  _providerName: 'google',
  profile: Record<string, unknown>,
): { providerUserId: string; email: string | null; displayName: string } {
  return {
    providerUserId: String(profile.id ?? profile.sub ?? ''),
    email: typeof profile.email === 'string' ? profile.email : null,
    displayName: typeof profile.name === 'string' ? profile.name
      : typeof profile.given_name === 'string' ? profile.given_name
      : 'Player',
  };
}
