import { useEffect, useState } from 'react';
import { fetchLeaderboard, fetchSimulLeaderboard } from '../lib/auth.js';
import { TopBar } from './TopBar.js';

type Tab = 'normal' | 'simul';

type NormalEntry = {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  rating: number;
  ratingGamesPlayed: number;
};

type SimulEntry = {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  simulRating: number;
  simulRatingGamesPlayed: number;
};

type Props = { onHome: () => void; onProfile?: () => void; username?: string | null };

export function LeaderboardPage({ onHome, onProfile, username }: Props) {
  const [tab, setTab] = useState<Tab>('normal');
  const [normalEntries, setNormalEntries] = useState<NormalEntry[]>([]);
  const [simulEntries, setSimulEntries] = useState<SimulEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = tab === 'normal' ? fetchLeaderboard() : fetchSimulLeaderboard();
    fetch
      .then((data) => {
        if (tab === 'normal') setNormalEntries(data as NormalEntry[]);
        else setSimulEntries(data as SimulEntry[]);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const entries = tab === 'normal' ? normalEntries : simulEntries;
  const empty = tab === 'normal'
    ? 'No rated games yet. Play a full game with 4 logged-in players to get on the board!'
    : 'No rated simul games yet.';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <TopBar onHome={onHome} onProfile={onProfile} username={username} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 20px' }}>
            Leaderboard
          </h1>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: 4,
            marginBottom: 20,
          }}>
            {(['normal', 'simul'] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '8px 0',
                    background: active ? (t === 'simul' ? 'rgba(167,139,250,0.15)' : 'rgba(86,219,211,0.12)') : 'transparent',
                    border: active ? `1px solid ${t === 'simul' ? 'rgba(167,139,250,0.35)' : 'rgba(86,219,211,0.3)'}` : '1px solid transparent',
                    borderRadius: 7,
                    color: active ? (t === 'simul' ? '#a78bfa' : '#56dbd3') : 'rgba(255,255,255,0.4)',
                    fontFamily: "'Geist', 'Inter', sans-serif",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  {t === 'normal' ? 'Bughouse' : 'Simul'}
                </button>
              );
            })}
          </div>

          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{empty}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
              {entries.map((e) => {
                const rating = tab === 'normal' ? (e as NormalEntry).rating : (e as SimulEntry).simulRating;
                const games = tab === 'normal' ? (e as NormalEntry).ratingGamesPlayed : (e as SimulEntry).simulRatingGamesPlayed;
                const accent = tab === 'simul' ? '#a78bfa' : '#56dbd3';
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      background: '#1a1a20',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, padding: '12px 16px',
                    }}
                  >
                    <span style={{
                      color: e.rank <= 3 ? accent : 'rgba(255,255,255,0.3)',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13, fontWeight: 700, minWidth: 28,
                    }}>
                      #{e.rank}
                    </span>
                    <span style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: 600 }}>
                      {e.username}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: accent, fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 16, fontWeight: 700,
                      }}>
                        {rating}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                        {games} game{games !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => history.back()}
            style={{
              marginTop: 8, padding: '11px 28px',
              background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
              color: '#0a0c10', border: 'none', borderRadius: 8,
              fontSize: 14, cursor: 'pointer', fontWeight: 800,
              letterSpacing: 0.3,
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
