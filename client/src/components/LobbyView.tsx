import React, { useState, useEffect } from 'react';
import { Seat, seatColor, seatBoard } from '@bughouse/shared';
import { TopBar } from './TopBar.js';
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
  onHome?: () => void;
  onProfile?: () => void;
  username?: string | null;
};

export function LobbyView({ store, code, send, onHome, onProfile, username }: Props) {
  const { yourSeat, isPrivate, isRated, names } = store;
  const [copied, setCopied] = useState(false);

  const handleClaim = (seat: Seat) => {
    send({ type: 'claim-seat', seat });
  };

  const handleReleaseSeat = () => {
    send({ type: 'release-seat' });
  };

  const handleReady = () => {
    send({ type: 'ready' });
  };

  const handleUnready = () => {
    send({ type: 'unready' });
  };

  const currentMinutes = Math.round((store.game?.initialClockMs ?? 5 * 60 * 1000) / 60000);

  const handleSetTimeControl = (minutes: number) => {
    send({ type: 'set-time-control', minutes });
  };

  const handleSetPrivate = (isPrivate: boolean) => {
    send({ type: 'set-private', isPrivate });
  };

  const handleSetRated = (isRated: boolean) => {
    send({ type: 'set-rated', isRated });
  };

  const anyGuestPresent = ([0, 1, 2, 3] as const).some(
    (s) => names[s] !== null && names[s]!.isGuest,
  );
  const ratedEnabled = yourSeat !== null && !anyGuestPresent;

  useEffect(() => {
    if (anyGuestPresent && isRated && yourSeat !== null) {
      send({ type: 'set-rated', isRated: false });
    }
  }, [anyGuestPresent, isRated, yourSeat, send]);

  const url = `${location.origin}/g/${code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 40% 30%, rgba(86,219,211,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(167,139,250,0.04) 0%, transparent 50%)',
      }} />

      <TopBar onHome={onHome ?? (() => {})} onProfile={onProfile} username={username} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>

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
              onClick={handleCopy}
              style={{
                padding: '5px 12px', fontSize: 11,
                background: copied ? 'rgba(86,219,211,0.18)' : 'rgba(86,219,211,0.1)',
                border: `1px solid ${copied ? 'rgba(86,219,211,0.5)' : 'rgba(86,219,211,0.25)'}`,
                borderRadius: 5, cursor: 'pointer',
                color: '#56dbd3', fontWeight: 600,
                fontFamily: "'Geist', 'Inter', sans-serif",
                whiteSpace: 'nowrap',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        </div>

        {/* Time control */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}>Time control</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((m) => {
              const selected = currentMinutes === m;
              return (
                <button
                  key={m}
                  onClick={() => handleSetTimeControl(m)}
                  style={{
                    padding: '6px 14px',
                    background: selected ? 'rgba(86,219,211,0.15)' : 'rgba(255,255,255,0.04)',
                    color: selected ? '#56dbd3' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${selected ? 'rgba(86,219,211,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13, fontWeight: selected ? 700 : 400,
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all 150ms',
                  }}
                >{m}+0</button>
              );
            })}
          </div>
        </div>

        {/* Private game toggle */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => yourSeat !== null && handleSetPrivate(!isPrivate)}
            disabled={yourSeat === null}
            style={{
              position: 'relative',
              width: 40, height: 22,
              background: isPrivate ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${isPrivate ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 11,
              cursor: yourSeat !== null ? 'pointer' : 'default',
              padding: 0,
              transition: 'background 200ms, border-color 200ms',
              opacity: yourSeat === null ? 0.4 : 1,
              flexShrink: 0,
            }}
            aria-label="Toggle private game"
          >
            <span style={{
              position: 'absolute',
              top: 2,
              left: isPrivate ? 20 : 2,
              width: 16, height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 200ms',
              display: 'block',
            }} />
          </button>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: isPrivate ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.35)',
              letterSpacing: 1, textTransform: 'uppercase',
              transition: 'color 200ms',
            }}>
              {isPrivate ? 'Private — hidden from lobby' : 'Public — visible in lobby'}
            </div>
          </div>
        </div>

        {/* Rated / Casual toggle */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => ratedEnabled && handleSetRated(!isRated)}
            disabled={!ratedEnabled}
            style={{
              position: 'relative',
              width: 40, height: 22,
              background: isRated ? 'rgba(86,219,211,0.6)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${isRated ? 'rgba(86,219,211,0.8)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 11,
              cursor: ratedEnabled ? 'pointer' : 'default',
              padding: 0,
              transition: 'background 200ms, border-color 200ms',
              opacity: !ratedEnabled ? 0.4 : 1,
              flexShrink: 0,
            }}
            aria-label="Toggle rated game"
          >
            <span style={{
              position: 'absolute',
              top: 2,
              left: isRated ? 20 : 2,
              width: 16, height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 200ms',
              display: 'block',
            }} />
          </button>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: anyGuestPresent
                ? 'rgba(255,255,255,0.2)'
                : isRated
                  ? 'rgba(86,219,211,0.9)'
                  : 'rgba(255,255,255,0.35)',
              letterSpacing: 1, textTransform: 'uppercase',
              transition: 'color 200ms',
            }}>
              {anyGuestPresent
                ? 'No rated game with anonymous player'
                : isRated
                  ? 'Rated — affects rankings'
                  : 'Casual — no rating change'}
            </div>
          </div>
        </div>

        {/* Seat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {([0, 1, 2, 3] as Seat[]).map((seat) => {
            const isMine = yourSeat === seat;
            const seatInfo = store.names[seat];
            const name = seatInfo?.name ?? null;
            const rating = seatInfo?.rating ?? null;
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
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                      {rating !== null && (
                        <span style={{
                          display: 'block',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10, color: 'rgba(86,219,211,0.7)',
                        }}>{rating}</span>
                      )}
                    </div>
                    {ready && isMine ? (
                      <button
                        onClick={handleUnready}
                        style={{
                          padding: '4px 12px',
                          background: 'transparent', color: '#34d399',
                          border: '1px solid #34d39955', borderRadius: 5,
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          fontFamily: "'Geist', 'Inter', sans-serif",
                        }}
                      >✓ READY ✕</button>
                    ) : ready ? (
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10, color: '#34d399',
                        letterSpacing: 0.5,
                      }}>✓ READY</span>
                    ) : isMine ? (
                      <>
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
                        <button
                          onClick={handleReleaseSeat}
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.5)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 5,
                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            fontFamily: "'Geist', 'Inter', sans-serif",
                          }}
                        >Leave seat</button>
                      </>
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
    </div>
  );
}
