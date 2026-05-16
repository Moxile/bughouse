import React, { useEffect, useMemo, useState } from 'react';
import { TopBar } from './TopBar.js';
import { GameHistoryList } from './GameHistoryList.js';
import { GameHistoryRow } from '@bughouse/shared';

// Minimum fields needed for any profile view.
type ProfileUser = {
  id?: string;
  username: string;
  displayName?: string; // only shown when isOwnProfile
  rating: number;
  ratingGamesPlayed: number;
  simulRating?: number;
  simulRatingGamesPlayed?: number;
};

type Props = {
  user: ProfileUser;
  isOwnProfile?: boolean; // defaults to true
  onBack?: () => void;    // shows the teal back button when provided
  onHome: () => void;
  onSettings?: () => void;
  onLogout?: () => Promise<void>;
  onOpenGame: (gameId: string) => void;
};

type SparkPoint = { ratingAfter: number; createdAt: string };
type Filter = 'all' | 'rated' | 'week';

function RatingSparkline({ points }: { points: SparkPoint[] }) {
  if (points.length < 2) return null;
  const ratings = points.map((p) => p.ratingAfter);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = max - min || 1;
  const W = 400;
  const H = 64;
  const pad = 4;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.ratingAfter - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const peakIdx = ratings.indexOf(max);
  const peakX = pad + (peakIdx / (points.length - 1)) * (W - pad * 2);
  const peakY = H - pad - ((max - min) / range) * (H - pad * 2);
  const lastX = pad + ((points.length - 1) / (points.length - 1)) * (W - pad * 2);
  const lastY = H - pad - ((ratings[ratings.length - 1]! - min) / range) * (H - pad * 2);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: 'rgba(255,255,255,0.35)',
          letterSpacing: 1, textTransform: 'uppercase',
        }}>Rating history</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: 'rgba(255,255,255,0.3)',
        }}>
          peak {max} · now {ratings[ratings.length - 1]}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H, display: 'block' }}
        preserveAspectRatio="none"
      >
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="#56dbd3"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Peak dot */}
        <circle cx={peakX} cy={peakY} r="3" fill="#56dbd3" opacity="0.9" />
        {/* Current dot */}
        <circle cx={lastX} cy={lastY} r="3" fill="#a78bfa" opacity="0.9" />
      </svg>
    </div>
  );
}

function WLCard({ games }: { games: GameHistoryRow[] }) {
  const rated = games.filter((g) => g.rated);
  if (rated.length === 0) return null;

  const wins = rated.filter((g) => {
    const selfTeam = g.selfSeat === 0 || g.selfSeat === 2 ? 0 : 1;
    return g.result.winningTeam === selfTeam;
  }).length;
  const losses = rated.length - wins;

  // Streak: count consecutive wins or losses from newest
  let streak = 0;
  let streakType: 'W' | 'L' | null = null;
  for (const g of rated) {
    const selfTeam = g.selfSeat === 0 || g.selfSeat === 2 ? 0 : 1;
    const won = g.result.winningTeam === selfTeam;
    if (streakType === null) {
      streakType = won ? 'W' : 'L';
      streak = 1;
    } else if ((streakType === 'W') === won) {
      streak++;
    } else {
      break;
    }
  }

  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 12,
    }}>
      <StatPill label="W" value={wins} color="#34d399" />
      <StatPill label="L" value={losses} color="#ff5757" />
      {streak > 1 && streakType && (
        <StatPill
          label={`${streakType} streak`}
          value={streak}
          color={streakType === 'W' ? '#34d399' : '#ff5757'}
        />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: `${color}18`,
      border: `1px solid ${color}44`,
      borderRadius: 8, padding: '5px 12px',
      display: 'flex', gap: 6, alignItems: 'baseline',
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 16, fontWeight: 700, color,
      }}>{value}</span>
      <span style={{
        fontFamily: "'Geist', 'Inter', sans-serif",
        fontSize: 10, color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>{label}</span>
    </div>
  );
}

export function ProfilePage({ user, isOwnProfile = true, onBack, onHome, onSettings, onLogout, onOpenGame }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sparkPoints, setSparkPoints] = useState<SparkPoint[]>([]);
  // Pre-fetch first page for WL card computation (own profile only).
  const [firstPageGames, setFirstPageGames] = useState<GameHistoryRow[]>([]);

  useEffect(() => {
    if (!isOwnProfile || !user.id) return;
    // Fetch sparkline data.
    fetch(`/api/users/${encodeURIComponent(user.id)}/rating-history`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: SparkPoint[]) => setSparkPoints(data))
      .catch(() => {});

    // Fetch first page of games for WL card.
    fetch(`/api/users/${encodeURIComponent(user.username)}/games?limit=50`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { games: GameHistoryRow[] } | null) => {
        if (data) setFirstPageGames(data.games);
      })
      .catch(() => {});
  }, [isOwnProfile, user.id, user.username]);

  const filterProps = useMemo(() => {
    if (filter === 'rated') return { ratedOnly: true };
    if (filter === 'week') return { sinceDays: 7 };
    return {};
  }, [filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'rated', label: 'Rated only' },
    { key: 'week', label: 'Last 7 days' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c10',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 20% 30%, rgba(86,219,211,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(167,139,250,0.05) 0%, transparent 50%)',
      }} />

      <TopBar onHome={onHome} username={isOwnProfile ? user.username : null} />

      <main style={{
        flex: 1, display: 'flex', gap: 0,
        position: 'relative', zIndex: 1,
        maxWidth: 1100, width: '100%', margin: '0 auto',
        padding: '40px 24px',
        boxSizing: 'border-box',
      }}>

        {/* ── Left rail ── */}
        <aside style={{
          width: 280, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 16,
          paddingRight: 32,
        }}>
          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              style={{
                alignSelf: 'flex-start',
                background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
                border: 'none',
                color: '#0a0c10', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Geist', 'Inter', sans-serif",
                boxShadow: '0 2px 12px rgba(86,219,211,0.2)',
              }}
            >← Back</button>
          )}

          {/* Avatar + identity */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '28px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#0a0c10',
              boxShadow: '0 4px 24px rgba(86,219,211,0.3)',
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{user.username}</div>
              {isOwnProfile && user.displayName && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12, color: 'rgba(255,255,255,0.4)',
                }}>{user.displayName}</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <StatRow label="Rating" value={String(user.rating)} accent="#56dbd3" large />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <StatRow label="Rated games" value={String(user.ratingGamesPlayed)} accent="#a78bfa" />
            {(user.simulRatingGamesPlayed ?? 0) > 0 && (
              <StatRow label="Simul rating" value={String(user.simulRating ?? 1200)} accent="#f59e0b" />
            )}
          </div>

          {/* Own-profile actions */}
          {isOwnProfile && onSettings && (
            <button
              onClick={onSettings}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px 0',
                background: 'rgba(86,219,211,0.08)',
                border: '1px solid rgba(86,219,211,0.2)',
                color: '#56dbd3', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(86,219,211,0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(86,219,211,0.08)'; }}
            >
              ⚙ Settings
            </button>
          )}
          {isOwnProfile && onLogout && (
            <button
              onClick={onLogout}
              style={{
                display: 'block', width: '100%', padding: '10px 0',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)', borderRadius: 10,
                fontSize: 13, cursor: 'pointer',
                transition: 'border-color 120ms, color 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            >
              Sign out
            </button>
          )}
        </aside>

        {/* ── Right column ── */}
        <section style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 0.3,
            }}>Game History</h2>
            {user.ratingGamesPlayed > 0 && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5,
              }}>{user.ratingGamesPlayed} rated game{user.ratingGamesPlayed !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Own-profile extras */}
          {isOwnProfile && (
            <>
              {sparkPoints.length >= 2 && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '14px 16px',
                  marginBottom: 12,
                }}>
                  <RatingSparkline points={sparkPoints} />
                </div>
              )}
              {firstPageGames.length > 0 && <WLCard games={firstPageGames} />}

              {/* Filter chips */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    style={{
                      background: filter === f.key ? 'rgba(86,219,211,0.15)' : 'rgba(255,255,255,0.04)',
                      border: filter === f.key ? '1px solid rgba(86,219,211,0.35)' : '1px solid rgba(255,255,255,0.1)',
                      color: filter === f.key ? '#56dbd3' : 'rgba(255,255,255,0.5)',
                      borderRadius: 6, padding: '5px 12px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Geist', 'Inter', sans-serif",
                      transition: 'all 0.15s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <GameHistoryList
            username={user.username}
            isOwnProfile={isOwnProfile}
            onOpenGame={onOpenGame}
            {...filterProps}
          />
        </section>

      </main>
    </div>
  );
}

function StatRow({ label, value, accent, large }: {
  label: string; value: string; accent: string; large?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, color: 'rgba(255,255,255,0.35)',
        letterSpacing: 1, textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: large ? 24 : 16, fontWeight: 700, color: accent,
      }}>{value}</span>
    </div>
  );
}
