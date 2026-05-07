import React from 'react';
import { Seat } from '@bughouse/shared';
import { useClock, formatClock } from '../hooks/useClock.js';
import type { GameStore } from '../hooks/useGame.js';

// Seat-indexed avatar colors (cyan, red, violet, amber)
const SEAT_AVATAR = [
  { main: '#56dbd3', dark: '#1a4f63' },
  { main: '#ef5757', dark: '#5a1818' },
  { main: '#a78bfa', dark: '#3b1f70' },
  { main: '#fbbf24', dark: '#5a3a06' },
] as const;

type Props = {
  seat: Seat;
  store: GameStore;
  isYou: boolean;
  position: 'top' | 'bottom';
  large?: boolean;
};

function Clock({ ms, active, large }: { ms: number; active: boolean; large?: boolean }) {
  const critical = ms < 10_000;
  const dangerous = ms < 30_000;
  const fontSize = large ? 22 : 18;

  const textColor = critical
    ? '#ff5757'
    : dangerous
    ? '#ffd479'
    : active
    ? '#56dbd3'
    : 'rgba(255,255,255,0.75)';

  const bgColor = active
    ? critical
      ? 'rgba(239,68,68,0.15)'
      : 'rgba(86,219,211,0.1)'
    : 'rgba(255,255,255,0.02)';

  const borderColor = active
    ? critical
      ? 'rgba(239,68,68,0.55)'
      : 'rgba(86,219,211,0.45)'
    : 'rgba(255,255,255,0.06)';

  const glow = active && critical
    ? '0 0 20px rgba(239,68,68,0.35)'
    : active
    ? '0 0 14px rgba(86,219,211,0.2)'
    : 'none';

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize,
      fontWeight: 700,
      letterSpacing: -0.5,
      lineHeight: 1,
      padding: large ? '5px 9px' : '4px 7px',
      borderRadius: 7,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
      boxShadow: glow,
      transition: 'all 200ms ease',
      fontVariantNumeric: 'tabular-nums',
      minWidth: large ? 78 : 64,
      textAlign: 'center',
      flexShrink: 0,
    }}>
      {formatClock(ms)}
    </div>
  );
}

export function PlayerStrip({ seat, store, isYou, position, large }: Props) {
  const ms = useClock(store.game, seat);
  const name = store.names[seat] ?? `Seat ${seat + 1}`;
  const ready = store.ready[seat];
  const connected = store.connected[seat];
  const seatHasPlayer = store.names[seat] !== null;

  const isActive = store.game?.status === 'playing' &&
    store.game.boards[seat < 2 ? 0 : 1].turn === (seat === 0 || seat === 3 ? 'w' : 'b');

  const avatar = SEAT_AVATAR[seat];
  const avatarSize = large ? 30 : 24;
  const fontSize = large ? 13 : 11;

  const borderRadius = position === 'top'
    ? '8px 8px 0 0'
    : '0 0 8px 8px';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: large ? '10px 14px' : '8px 12px',
      width: '100%',
      boxSizing: 'border-box',
      borderBottom: position === 'top' ? '1px solid rgba(255,255,255,0.05)' : undefined,
      borderTop: position === 'bottom' ? '1px solid rgba(255,255,255,0.05)' : undefined,
    }}>
      {/* Left: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${avatar.main} 0%, ${avatar.dark} 100%)`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: large ? 15 : 12,
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.12)',
          userSelect: 'none',
        }}>
          {name[0]?.toUpperCase()}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize,
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: large ? 160 : 100,
              display: 'block',
            }}>
              {name}
              {isYou && (
                <span style={{ color: '#56dbd3', marginLeft: 5, fontWeight: 500, fontSize: fontSize - 1 }}>
                  (you)
                </span>
              )}
            </span>
            {!connected && seatHasPlayer && (
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, flexShrink: 0 }}>●</span>
            )}
          </div>

          {store.game?.status === 'lobby' && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: ready ? '#34d399' : 'rgba(255,255,255,0.35)',
              letterSpacing: 0.5,
            }}>
              {ready ? '✓ READY' : 'NOT READY'}
            </span>
          )}
        </div>
      </div>

      {/* Right: clock */}
      {store.game?.status !== 'lobby' && (
        <Clock ms={ms} active={isActive} large={large} />
      )}
    </div>
  );
}
