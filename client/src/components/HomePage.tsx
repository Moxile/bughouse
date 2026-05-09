import React, { useEffect, useState } from 'react';

type RoomSummary = {
  code: string;
  status: 'lobby' | 'playing';
  players: (string | null)[];
};

type Props = { onJoin: (code: string) => void; onRules: () => void };

export function HomePage({ onJoin, onRules }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveGames, setLiveGames] = useState<RoomSummary[]>([]);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/games')
        .then((r) => r.json())
        .then((rooms: RoomSummary[]) => setLiveGames(rooms.filter((r) => r.status === 'playing')))
        .catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const createGame = async () => {
    setLoading(true);
    const res = await fetch('/api/games', { method: 'POST' });
    const { code } = await res.json();
    onJoin(code as string);
    setLoading(false);
  };

  const joinGame = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 6) onJoin(c);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 16px',
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(86,219,211,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(167,139,250,0.05) 0%, transparent 50%)',
      }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: '#0a0c10',
          }}>♞</div>
          <span style={{
            fontFamily: "'Geist', 'Inter', sans-serif",
            fontSize: 24, fontWeight: 800,
            letterSpacing: 0.5,
          }}>BUGHOUSE</span>
        </div>

        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'rgba(255,255,255,0.35)',
          marginBottom: 40, fontSize: 12,
          textAlign: 'center', letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          4-player · 2-board chess variant
        </p>

        {/* Create game */}
        <button
          onClick={createGame}
          disabled={loading}
          style={{
            display: 'block', width: '100%', padding: '14px 0',
            background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
            color: '#0a0c10',
            border: 'none',
            borderRadius: 10, fontSize: 15,
            cursor: loading ? 'default' : 'pointer',
            marginBottom: 10, fontWeight: 700,
            fontFamily: "'Geist', 'Inter', sans-serif",
            letterSpacing: 0.3,
            boxShadow: '0 4px 24px rgba(86,219,211,0.25)',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 120ms',
          }}
        >
          {loading ? 'Creating…' : '+ Create Game'}
        </button>

        {/* Rules */}
        <button
          onClick={onRules}
          style={{
            display: 'block', width: '100%', padding: '12px 0',
            background: 'transparent',
            color: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, fontSize: 14,
            cursor: 'pointer', marginBottom: 28,
            fontFamily: "'Geist', 'Inter', sans-serif",
            fontWeight: 500,
            transition: 'border-color 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
          }}
        >
          Rules
        </button>

        {/* Join with code */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '16px',
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 1, textTransform: 'uppercase',
            marginBottom: 10,
          }}>Join with code</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
              placeholder="XXXXXX"
              style={{
                flex: 1, padding: '10px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 7, fontSize: 16,
                letterSpacing: 4, textTransform: 'uppercase',
                color: '#fff', outline: 'none',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            />
            <button
              onClick={joinGame}
              disabled={code.trim().length !== 6}
              style={{
                padding: '10px 20px',
                background: code.trim().length === 6 ? '#56dbd3' : 'rgba(86,219,211,0.15)',
                color: code.trim().length === 6 ? '#0a0a0a' : 'rgba(86,219,211,0.4)',
                border: 'none', borderRadius: 7,
                cursor: code.trim().length === 6 ? 'pointer' : 'default',
                fontWeight: 700, fontSize: 14,
                fontFamily: "'Geist', 'Inter', sans-serif",
                transition: 'all 120ms',
              }}
            >
              Join
            </button>
          </div>
        </div>

        <p style={{
          marginTop: 36, color: 'rgba(255,255,255,0.25)', fontSize: 12,
          textAlign: 'center',
          fontFamily: "'Geist', 'Inter', sans-serif",
        }}>
          Follow on{' '}
          <a href="https://github.com/Moxile" target="_blank" rel="noopener noreferrer"
            style={{ color: '#56dbd3', textDecoration: 'none' }}>
            GitHub
          </a>
          {' '}· Join{' '}
          <a href="https://discord.gg/NbdDfJ4m22" target="_blank" rel="noopener noreferrer"
            style={{ color: '#a78bfa', textDecoration: 'none' }}>
            Discord
          </a>
        </p>

        {liveGames.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: 'rgba(255,255,255,0.35)',
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
              textAlign: 'center',
            }}>Live games</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liveGames.map((r) => {
                const players = r.players.filter(Boolean) as string[];
                return (
                  <div key={r.code}
                    onClick={() => onJoin(r.code)}
                    onMouseEnter={() => setHoveredCode(r.code)}
                    onMouseLeave={() => setHoveredCode(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: hoveredCode === r.code ? 'rgba(52,211,153,0.10)' : 'rgba(52,211,153,0.04)',
                      border: '1px solid rgba(52,211,153,0.15)',
                      borderRadius: 8, padding: '8px 12px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 10, flexShrink: 0,
                      fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
                      color: '#34d399',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#34d399',
                        boxShadow: '0 0 6px #34d399',
                        display: 'inline-block',
                      }} />
                      LIVE
                    </span>
                    <span style={{
                      flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{players.join(' · ')}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: 'rgba(255,255,255,0.2)', flexShrink: 0,
                      letterSpacing: 1,
                    }}>{r.code}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
