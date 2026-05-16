import React from 'react';
import { Seat } from '@bughouse/shared';
import { formatClock } from '../hooks/useClock.js';

const SEAT_AVATAR = [
  { main: '#56dbd3', dark: '#1a4f63' },
  { main: '#ef5757', dark: '#5a1818' },
  { main: '#a78bfa', dark: '#3b1f70' },
  { main: '#fbbf24', dark: '#5a3a06' },
] as const;

type Props = {
  seat: Seat;
  name: string;
  ratingDelta: number | null;
  clockMs: number;
  position: 'top' | 'bottom';
};

export function ReplayPlayerStrip({ seat, name, ratingDelta, clockMs, position }: Props) {
  const avatar = SEAT_AVATAR[seat];
  const critical = clockMs < 10_000;
  const dangerous = clockMs < 30_000;

  const clockColor = critical ? '#ff5757' : dangerous ? '#ffd479' : 'rgba(255,255,255,0.75)';
  const clockBg = critical ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)';
  const clockBorder = critical ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.08)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 10, padding: '7px 12px', width: '100%', boxSizing: 'border-box',
      borderBottom: position === 'top' ? '1px solid rgba(255,255,255,0.05)' : undefined,
      borderTop: position === 'bottom' ? '1px solid rgba(255,255,255,0.05)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: `linear-gradient(135deg, ${avatar.main} 0%, ${avatar.dark} 100%)`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontWeight: 700, fontSize: 11, color: '#fff',
          border: '1px solid rgba(255,255,255,0.12)',
          userSelect: 'none',
        }}>
          {name[0]?.toUpperCase()}
        </div>
        <span style={{
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 11, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100,
        }}>
          {name}
        </span>
        {ratingDelta !== null && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, fontWeight: 700,
            color: ratingDelta >= 0 ? '#34d399' : '#ff5757',
            background: ratingDelta >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(239,87,87,0.12)',
            border: `1px solid ${ratingDelta >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(239,87,87,0.3)'}`,
            borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          }}>
            {ratingDelta >= 0 ? '+' : ''}{ratingDelta}
          </span>
        )}
      </div>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 16, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1,
        padding: '4px 7px', borderRadius: 7,
        background: clockBg, border: `1px solid ${clockBorder}`,
        color: clockColor, fontVariantNumeric: 'tabular-nums',
        minWidth: 62, textAlign: 'center', flexShrink: 0,
      }}>
        {formatClock(clockMs)}
      </div>
    </div>
  );
}
