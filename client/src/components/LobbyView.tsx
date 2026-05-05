import React from 'react';
import { Seat, seatColor, seatBoard } from '@bughouse/shared';
import type { GameStore } from '../hooks/useGame.js';

const SEAT_LABELS = ['Board 1 — White', 'Board 1 — Black', 'Board 2 — Black', 'Board 2 — White'];
const TEAM_COLORS = ['#dbeafe', '#dcfce7']; // team 0 = blue, team 1 = green
// Teams: seat 0 & 2 = team 0; seat 1 & 3 = team 1.
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
    <div style={{ maxWidth: 540, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 4 }}>Bughouse Chess</h2>
      <p style={{ marginBottom: 16, color: '#555', fontSize: 14 }}>
        Share this link with 3 friends:
      </p>
      <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '8px 12px', marginBottom: 24, fontSize: 13, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>{url}</span>
        <button onClick={() => navigator.clipboard.writeText(url)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}>Copy</button>
      </div>

      <label style={{ display: 'block', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Your name:</span>
        <input
          value={playerName}
          onChange={(e) => onSetName(e.target.value.slice(0, 20))}
          style={{ display: 'block', marginTop: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14, width: 200 }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {([0, 1, 2, 3] as Seat[]).map((seat) => {
          const isMine = yourSeat === seat;
          const name = store.names[seat];
          const ready = store.ready[seat];
          const team = TEAM_OF[seat];
          const taken = name !== null && !isMine;
          return (
            <div
              key={seat}
              style={{
                background: TEAM_COLORS[team],
                border: `2px solid ${isMine ? '#2563eb' : '#d1d5db'}`,
                borderRadius: 8,
                padding: '10px 14px',
              }}
            >
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                {SEAT_LABELS[seat]} · Team {team + 1}
              </div>
              {name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  {ready && <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>}
                  {isMine && !ready && (
                    <button
                      onClick={handleReady}
                      style={{ padding: '2px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                    >
                      Ready
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleClaim(seat)}
                  disabled={yourSeat !== null && yourSeat !== seat}
                  style={{ padding: '3px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                >
                  Sit here
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 13, color: '#6b7280' }}>
        All 4 players must click <strong>Ready</strong> to start. Game begins automatically.
      </div>
    </div>
  );
}
