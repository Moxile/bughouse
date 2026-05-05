import React from 'react';
import { Seat } from '@bughouse/shared';
import { useClock, formatClock } from '../hooks/useClock.js';
import type { GameStore } from '../hooks/useGame.js';

type Props = {
  seat: Seat;
  store: GameStore;
  isYou: boolean;
  position: 'top' | 'bottom';
};

export function PlayerStrip({ seat, store, isYou, position }: Props) {
  const ms = useClock(store.game, seat);
  const name = store.names[seat] ?? `Seat ${seat + 1}`;
  const ready = store.ready[seat];
  const connected = store.connected[seat];
  const seatHasPlayer = store.names[seat] !== null;

  const flagging = ms < 10_000;
  const clockStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: 'bold',
    color: flagging ? '#dc2626' : '#111',
    background: flagging ? '#fee2e2' : '#f3f4f6',
    padding: '2px 10px',
    borderRadius: 6,
    minWidth: 68,
    textAlign: 'center',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 8px',
      background: isYou ? '#eff6ff' : '#f9fafb',
      border: `1px solid ${isYou ? '#3b82f6' : '#e5e7eb'}`,
      borderRadius: 6,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: isYou ? 700 : 400, fontSize: 14, minWidth: 100 }}>
        {name}{isYou ? ' (you)' : ''}
        {!connected && seatHasPlayer && <span style={{ color: '#9ca3af', marginLeft: 4 }}>●</span>}
      </span>
      {store.game?.status === 'lobby' && (
        <span style={{ fontSize: 12, color: ready ? '#16a34a' : '#6b7280' }}>
          {ready ? '✓ Ready' : 'Not ready'}
        </span>
      )}
      {store.game?.status !== 'lobby' && <div style={clockStyle}>{formatClock(ms)}</div>}
    </div>
  );
}
