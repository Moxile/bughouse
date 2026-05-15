import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../lib/auth.js';
import { TopBar } from './TopBar.js';

type Entry = {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  rating: number;
  ratingGamesPlayed: number;
};

type Props = { onHome: () => void; onProfile?: () => void; username?: string | null };

export function LeaderboardPage({ onHome, onProfile, username }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then((data) => setEntries(data as Entry[]))
      .finally(() => setLoading(false));
  }, []);

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
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 24px' }}>
          Leaderboard
        </h1>

        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            No rated games yet. Play a full game with 4 logged-in players to get on the board!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
            {entries.map((e) => (
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
                  color: e.rank <= 3 ? '#56dbd3' : 'rgba(255,255,255,0.3)',
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
                    color: '#56dbd3', fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 16, fontWeight: 700,
                  }}>
                    {e.rating}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    {e.ratingGamesPlayed} game{e.ratingGamesPlayed !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => history.back()}
          style={{
            marginTop: 8, padding: '11px 28px',
            background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
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
