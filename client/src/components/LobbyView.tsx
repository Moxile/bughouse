import React, { useState } from 'react';
import { Seat } from '@bughouse/shared';
import { TopBar } from './TopBar.js';
import type { GameStore } from '../hooks/useGame.js';

// Team 0: seats 0 & 2 (teal) — Team 1: seats 1 & 3 (red)
const TEAM_COLOR = ['#56dbd3', '#ef5757'] as const;
const TEAM_BG    = ['rgba(86,219,211,0.08)', 'rgba(239,87,87,0.08)'] as const;
const TEAM_BORDER= ['rgba(86,219,211,0.3)', 'rgba(239,87,87,0.3)'] as const;
const SEAT_COLOR_LABEL = ['White', 'Black', 'Black', 'White'] as const;
const SEAT_BOARD_LABEL = ['Board 1', 'Board 1', 'Board 2', 'Board 2'] as const;
const SEAT_TEAM  = [0, 1, 0, 1] as const;

// Team rows: Team 0 → [Seat 0 (B1 White), Seat 2 (B2 Black)]
//            Team 1 → [Seat 1 (B1 Black), Seat 3 (B2 White)]
const TEAM_SEATS: [Seat[], Seat[]] = [[0, 2], [1, 3]];

type Props = {
  store: GameStore;
  code: string;
  send: (msg: any) => void;
  onHome?: () => void;
  onProfile?: () => void;
  username?: string | null;
};

export function LobbyView({ store, code, send, onHome, onProfile, username }: Props) {
  const { yourSeat, isRated, names, ownerSeat, ratingRange } = store;
  const yourSeats: Seat[] = (store as any).yourSeats ?? (yourSeat !== null ? [yourSeat] : []);
  const simulTeams: { 0: boolean; 1: boolean } = (store as any).simulTeams ?? { 0: false, 1: false };
  const allowSimul: boolean = (store as any).allowSimul ?? false;
  const [copied, setCopied] = useState(false);

  const isOwner = yourSeat !== null && yourSeat === ownerSeat;

  const handleClaim  = (seat: Seat) => send({ type: 'claim-seat', seat });
  const handleRelease = () => send({ type: 'release-seat' });
  const handleClaimSimul = (team: 0 | 1) => send({ type: 'claim-simul', team });
  const handleReleaseSimul = (team: 0 | 1) => send({ type: 'release-simul', team });
  const handleReady  = () => send({ type: 'ready' });
  const handleUnready = () => send({ type: 'unready' });
  const handleKick   = (seat: Seat) => send({ type: 'kick-seat', seat });

  const currentMinutes = Math.round((store.game?.initialClockMs ?? 5 * 60 * 1000) / 60000);

  const handleSetTimeControl = (m: number) => send({ type: 'set-time-control', minutes: m });
  const handleSetRated   = (v: boolean) => send({ type: 'set-rated', isRated: v });

  const anyGuestPresent = ([0, 1, 2, 3] as Seat[]).some(
    (s) => names[s] !== null && names[s]!.isGuest,
  );
  const canEnableRated = isOwner && !anyGuestPresent && store.names[yourSeat!]?.isGuest === false;

  const url = `${location.origin}/g/${code}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif", position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 40% 30%, rgba(86,219,211,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(167,139,250,0.04) 0%, transparent 50%)',
      }} />

      <TopBar onHome={onHome ?? (() => {})} onProfile={onProfile} username={username} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 600, position: 'relative', zIndex: 1 }}>

        {/* Share link */}
        <div style={{ marginBottom: 24 }}>
          <Label>Share with 3 friends</Label>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              flex: 1, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13, color: '#56dbd3', wordBreak: 'break-all', letterSpacing: 0.5,
            }}>{url}</span>
            <button onClick={handleCopy} style={{
              padding: '5px 12px', fontSize: 11,
              background: copied ? 'rgba(86,219,211,0.18)' : 'rgba(86,219,211,0.1)',
              border: `1px solid ${copied ? 'rgba(86,219,211,0.5)' : 'rgba(86,219,211,0.25)'}`,
              borderRadius: 5, cursor: 'pointer', color: '#56dbd3', fontWeight: 600,
              fontFamily: "'Geist', 'Inter', sans-serif", whiteSpace: 'nowrap',
              transition: 'background 0.2s, border-color 0.2s',
            }}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        </div>

        {/* Settings row */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '14px 16px',
          marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 20,
        }}>
          {/* Time control */}
          <div style={{ flex: '1 1 auto', minWidth: 200 }}>
            <Label dim>Time control {!isOwner && <OwnerBadge />}</Label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map((m) => {
                const sel = currentMinutes === m;
                return (
                  <button
                    key={m}
                    onClick={() => isOwner && handleSetTimeControl(m)}
                    style={{
                      padding: '5px 12px',
                      background: sel ? 'rgba(86,219,211,0.15)' : 'rgba(255,255,255,0.04)',
                      color: sel ? '#56dbd3' : 'rgba(255,255,255,0.45)',
                      border: `1px solid ${sel ? 'rgba(86,219,211,0.5)' : 'rgba(255,255,255,0.09)'}`,
                      borderRadius: 6, cursor: isOwner ? 'pointer' : 'default',
                      fontSize: 13, fontWeight: sel ? 700 : 400,
                      fontFamily: "'JetBrains Mono', monospace",
                      opacity: !isOwner && !sel ? 0.5 : 1,
                      transition: 'all 150ms',
                    }}
                  >{m}+0</button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            <Toggle
              active={isRated}
              onToggle={() => canEnableRated || (isOwner && isRated) ? handleSetRated(!isRated) : undefined}
              disabled={!isOwner || (!isRated && !canEnableRated)}
              activeColor="#56dbd3"
              label={anyGuestPresent ? 'Casual (guest present)' : isRated ? 'Rated' : 'Casual'}
            />
          </div>
        </div>

        {/* Rating range display (if set) */}
        {ratingRange && (
          <div style={{
            marginBottom: 16,
            padding: '8px 14px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 13 }}>⭐</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: 'rgba(251,191,36,0.9)',
            }}>
              Rating range: {ratingRange.min} – {ratingRange.max}
            </span>
            {isOwner && (
              <button
                onClick={() => send({ type: 'set-rating-range', min: null, max: null })}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  color: 'rgba(251,191,36,0.5)', fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
              >Remove</button>
            )}
          </div>
        )}

        {/* Seat grid — team-separated layout */}
        <div style={{ marginBottom: 20 }}>
          {/* Board column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8, padding: '0 2px' }}>
            {(['Board 1', 'Board 2'] as const).map((label) => (
              <div key={label} style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
            ))}
          </div>

          {([0, 1] as (0 | 1)[]).map((team, idx) => {
            const teamSeats = TEAM_SEATS[team]!;
            const color = TEAM_COLOR[team];
            const label = team === 0 ? 'Team Teal' : 'Team Red';
            const isSimulTeam = simulTeams[team];
            const iAmOnTeam = yourSeats.some((s) => teamSeats.includes(s as Seat));
            const teamFull = teamSeats.every((s) => names[s as Seat] !== null);
            const canSimul = allowSimul && !isSimulTeam && !iAmOnTeam && yourSeats.length === 0 && !teamFull;
            const mySimulTeam = isSimulTeam && iAmOnTeam;

            return (
              <React.Fragment key={team}>
                {idx === 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>VS</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                )}
                <div style={{
                  background: `${color}07`,
                  border: `1px solid ${color}28`,
                  borderRadius: 12,
                  padding: '10px 12px',
                }}>
                  {/* Team header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
                    {isSimulTeam && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(167,139,250,0.8)', letterSpacing: 1 }}>SIMUL</span>}
                    {allowSimul && (
                      <div style={{ marginLeft: 'auto' }}>
                        {mySimulTeam ? (
                          <button
                            onClick={() => handleReleaseSimul(team)}
                            style={{
                              padding: '3px 10px', fontSize: 9,
                              background: 'rgba(167,139,250,0.1)', color: 'rgba(167,139,250,0.7)',
                              border: '1px solid rgba(167,139,250,0.3)', borderRadius: 5,
                              cursor: 'pointer', fontFamily: "'Geist', 'Inter', sans-serif",
                            }}
                          >Leave both seats</button>
                        ) : canSimul ? (
                          <button
                            onClick={() => handleClaimSimul(team)}
                            style={{
                              padding: '3px 10px', fontSize: 9,
                              background: 'rgba(167,139,250,0.1)', color: 'rgba(167,139,250,0.8)',
                              border: '1px solid rgba(167,139,250,0.3)', borderRadius: 5,
                              cursor: 'pointer', fontFamily: "'Geist', 'Inter', sans-serif",
                              fontWeight: 600,
                            }}
                          >Simul both seats</button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {/* Two seats for this team */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {teamSeats.map((seat) => (
                      <SeatCard
                        key={seat}
                        seat={seat as Seat}
                        store={store}
                        yourSeat={yourSeat}
                        yourSeats={yourSeats}
                        simulTeams={simulTeams}
                        isOwner={isOwner}
                        ownerSeat={ownerSeat}
                        onClaim={handleClaim}
                        onRelease={handleRelease}
                        onReleaseSimul={handleReleaseSimul}
                        onReady={handleReady}
                        onUnready={handleUnready}
                        onKick={handleKick}
                      />
                    ))}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.6,
        }}>
          All seats must be filled and everyone must click{' '}
          <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Ready</strong> to start.
        </div>

      </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Label({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9, color: dim ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.4)',
      letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>{children}</div>
  );
}

function OwnerBadge() {
  return (
    <span style={{
      fontFamily: "'Geist', 'Inter', sans-serif",
      fontSize: 9, color: 'rgba(251,191,36,0.6)',
      letterSpacing: 0.5, textTransform: 'none',
    }}>owner only</span>
  );
}

function Toggle({
  active, onToggle, disabled, activeColor, label,
}: { active: boolean; onToggle: () => void; disabled?: boolean; activeColor: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: disabled ? 0.45 : 1 }}>
      <button
        onClick={onToggle}
        style={{
          position: 'relative', width: 36, height: 20,
          background: active ? activeColor + '99' : 'rgba(255,255,255,0.1)',
          border: `1px solid ${active ? activeColor : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
          padding: 0, transition: 'background 200ms, border-color 200ms', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: active ? 18 : 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left 200ms', display: 'block',
        }} />
      </button>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, color: active ? activeColor : 'rgba(255,255,255,0.35)',
        letterSpacing: 0.8, textTransform: 'uppercase', transition: 'color 200ms',
        whiteSpace: 'nowrap',
      }}>{label}</span>
    </div>
  );
}

function SeatCard({
  seat, store, yourSeat, yourSeats, simulTeams, isOwner, ownerSeat, onClaim, onRelease, onReleaseSimul, onReady, onUnready, onKick,
}: {
  seat: Seat;
  store: GameStore;
  yourSeat: Seat | null;
  yourSeats: Seat[];
  simulTeams: { 0: boolean; 1: boolean };
  isOwner: boolean;
  ownerSeat: Seat | null;
  onClaim: (s: Seat) => void;
  onRelease: () => void;
  onReleaseSimul: (team: 0 | 1) => void;
  onReady: () => void;
  onUnready: () => void;
  onKick: (s: Seat) => void;
}) {
  const team = SEAT_TEAM[seat] as 0 | 1;
  const teamColor  = TEAM_COLOR[team];
  const teamBg     = TEAM_BG[team];
  const teamBorder = TEAM_BORDER[team];
  const isMine = yourSeats.includes(seat);
  const isSimulTeam = simulTeams[team];
  const seatInfo = store.names[seat];
  const name = seatInfo?.name ?? null;
  const rating = seatInfo?.rating ?? null;
  const ready = store.ready[seat];
  const isOccupied = name !== null;
  const isSeatOwner = ownerSeat === seat;
  const colorLabel = SEAT_COLOR_LABEL[seat];

  const canClaim = !isOccupied && yourSeats.length === 0 && !isSimulTeam;
  const canKick = isOwner && !isMine && isOccupied;

  return (
    <div style={{
      background: isMine ? teamBg : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isMine ? teamBorder : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `3px solid ${isOccupied ? teamColor : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 10,
      padding: '12px 14px',
      transition: 'border-color 200ms',
      minHeight: 88,
      position: 'relative',
    }}>
      {/* Color label */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 8, color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: teamColor }}>●</span>
        {colorLabel}
        {isMine && <span style={{ color: '#56dbd3', marginLeft: 'auto' }}>you</span>}
      </div>

      {isOccupied ? (
        <div>
          {/* Player info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}55 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {name![0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isSeatOwner && <span title="Room owner" style={{ fontSize: 12, lineHeight: 1 }}>👑</span>}
                <span style={{
                  fontWeight: 600, fontSize: 14, color: '#fff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: 110,
                }}>{name}</span>
              </div>
              {rating !== null && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, color: teamColor, fontWeight: 600,
                }}>{rating}</span>
              )}
            </div>
            {/* Kick button (owner only, not on own seat) */}
            {canKick && (
              <button
                onClick={() => onKick(seat)}
                title="Kick player"
                style={{
                  background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                  color: 'rgba(239,68,68,0.6)', borderRadius: 5, padding: '3px 8px',
                  fontSize: 10, cursor: 'pointer', flexShrink: 0,
                  fontFamily: "'Geist', 'Inter', sans-serif",
                  transition: 'border-color 120ms, color 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef5757'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              >Kick</button>
            )}
          </div>

          {/* Ready controls */}
          {isMine && !ready && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={onReady}
                style={{
                  flex: 1, padding: '5px 0',
                  background: '#34d399', color: '#0a0a0a',
                  border: 'none', borderRadius: 5,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
              >Ready</button>
              <button
                onClick={() => isSimulTeam ? onReleaseSimul(team) : onRelease()}
                style={{
                  padding: '5px 10px',
                  background: 'transparent', color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5,
                  cursor: 'pointer', fontSize: 11,
                  fontFamily: "'Geist', 'Inter', sans-serif",
                }}
              >Leave</button>
            </div>
          )}
          {isMine && ready && (
            <button
              onClick={onUnready}
              style={{
                width: '100%', padding: '5px 0',
                background: 'transparent', color: '#34d399',
                border: '1px solid #34d39955', borderRadius: 5,
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                fontFamily: "'Geist', 'Inter', sans-serif",
              }}
            >✓ Ready — click to unready</button>
          )}
          {!isMine && (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: ready ? '#34d399' : 'rgba(255,255,255,0.3)',
              letterSpacing: 0.5,
            }}>
              {ready ? '✓ Ready' : 'Not ready'}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => canClaim && onClaim(seat)}
          disabled={!canClaim}
          style={{
            width: '100%', padding: '8px 0',
            background: canClaim ? `${teamColor}22` : 'transparent',
            color: canClaim ? teamColor : 'rgba(255,255,255,0.2)',
            border: `1px solid ${canClaim ? teamColor + '55' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, cursor: canClaim ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600,
            fontFamily: "'Geist', 'Inter', sans-serif",
            transition: 'all 150ms',
          }}
        >{canClaim ? 'Sit here' : 'Empty'}</button>
      )}
    </div>
  );
}
