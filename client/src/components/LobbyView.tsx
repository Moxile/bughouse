import React from 'react';
import { Seat, seatColor, seatBoard } from '@bughouse/shared';
import type { GameStore } from '../hooks/useGame.js';

const SEAT_LABELS = ['Board 1 — White', 'Board 1 — Black', 'Board 2 — Black', 'Board 2 — White'];

// Team 0: seats 0 & 2 (cyan/violet) — Team 1: seats 1 & 3 (red/amber)
const SEAT_ACCENT = ['#56dbd3', '#ef5757', '#a78bfa', '#fbbf24'] as const;
const SEAT_BG     = [
  'rgba(86,219,211,0.06)',
  'rgba(239,87,87,0.06)',
  'rgba(167,139,250,0.06)',
  'rgba(251,191,36,0.06)',
] as const;
const TEAM_OF: Record<Seat, 0 | 1> = { 0: 0, 1: 1, 2: 0, 3: 1 };

type Props = {
  store: GameStore;
  code: string;
  send: (msg: any) => void;
  onSetName: (name: string) => void;
  playerName: string;
};

export function LobbyView({ store, code, send, onSetName, playerName }: Props) {
  const { yourSeat } = store;

  const handleClaim = (seat: Seat) => {
    send({ type: 'claim-seat', seat });
  };

  const handleReady = () => {
    send({ type: 'ready' });
  };

  const url = `${location.origin}/g/${code}`;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      fontFamily: "'Geist', 'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 40% 30%, rgba(86,219,211,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(167,139,250,0.04) 0%, transparent 50%)',
      }} />

      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: '#0a0c10',
          }}>♞</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>BUGHOUSE</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.3)',
            letterSpacing: 1, marginLeft: 8,
            textTransform: 'uppercase',
          }}>lobby</span>
        </div>

        {/* Share link */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}>Share with 3 friends</div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              flex: 1, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13, color: '#56dbd3', wordBreak: 'break-all',
              letterSpacing: 0.5,
            }}>{url}</span>
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              style={{
                padding: '5px 12px', fontSize: 11,
                background: 'rgba(86,219,211,0.1)',
                border: '1px solid rgba(86,219,211,0.25)',
                borderRadius: 5, cursor: 'pointer',
                color: '#56dbd3', fontWeight: 600,
                fontFamily: "'Geist', 'Inter', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >Copy</button>
          </div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 1, textTransform: 'uppercase',
            display: 'block', marginBottom: 8,
          }}>Your name</label>
          <input
            value={playerName}
            onChange={(e) => onSetName(e.target.value.slice(0, 20))}
            style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, fontSize: 14, color: '#fff',
              outline: 'none', width: 220,
              fontFamily: "'Geist', 'Inter', sans-serif",
            }}
          />
        </div>

        {/* Seat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {([0, 1, 2, 3] as Seat[]).map((seat) => {
            const isMine = yourSeat === seat;
            const name = store.names[seat];
            const ready = store.ready[seat];
            const team = TEAM_OF[seat];
            const accent = SEAT_ACCENT[seat];
            const bg = SEAT_BG[seat];

            return (
              <div
                key={seat}
                style={{
                  background: isMine ? bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isMine ? accent + '55' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  transition: 'border-color 200ms',
                }}
              >
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, color: 'rgba(255,255,255,0.35)',
                  letterSpacing: 1, textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  {SEAT_LABELS[seat]} · Team {team + 1}
                </div>
                {name ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${accent} 0%, ${accent}55 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      flexShrink: 0,
                    }}>{name[0]?.toUpperCase()}</div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                    {ready ? (
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10, color: '#34d399',
                        letterSpacing: 0.5,
                      }}>✓ READY</span>
                    ) : isMine ? (
                      <button
                        onClick={handleReady}
                        style={{
                          padding: '4px 12px',
                          background: '#34d399', color: '#0a0a0a',
                          border: 'none', borderRadius: 5,
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          fontFamily: "'Geist', 'Inter', sans-serif",
                        }}
                      >Ready</button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(seat)}
                    disabled={yourSeat !== null && yourSeat !== seat}
                    style={{
                      padding: '6px 14px',
                      background: `${accent}22`,
                      color: accent,
                      border: `1px solid ${accent}55`,
                      borderRadius: 6,
                      cursor: (yourSeat !== null && yourSeat !== seat) ? 'default' : 'pointer',
                      fontSize: 12, fontWeight: 600,
                      fontFamily: "'Geist', 'Inter', sans-serif",
                      opacity: (yourSeat !== null && yourSeat !== seat) ? 0.4 : 1,
                    }}
                  >Sit here</button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          letterSpacing: 0.5, textAlign: 'center',
          lineHeight: 1.6,
        }}>
          All 4 players must click <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Ready</strong> to start.
          Game begins automatically.
        </div>
      </div>
    </div>
  );
}
