import type { AuthUser } from '@bughouse/shared';

export type { AuthUser };

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) return null;
  const data = await res.json() as { user: AuthUser | null };
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function updateUsername(username: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch('/api/users/me', { method: 'PATCH', body: JSON.stringify({ username }) });
  return res.json();
}

export async function fetchLeaderboard(): Promise<{
  rank: number;
  id: string;
  username: string;
  displayName: string;
  rating: number;
  ratingGamesPlayed: number;
}[]> {
  const res = await apiFetch('/api/leaderboard');
  if (!res.ok) return [];
  return res.json();
}
