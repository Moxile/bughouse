import React, { useEffect, useMemo, useRef } from 'react';
import { GameEvent, buildSanList } from '@bughouse/shared';

type Props = {
  events: GameEvent[];
  initialClockMs: number;
  playerNames: [string, string, string, string]; // [seat0, seat1, seat2, seat3]
  highlightedIndex: number | null;
  onJumpToIndex: (index: number) => void;
  height?: number;
};

// Column order: B0-White (seat 0) | B0-Black (seat 1) | B1-White (seat 3) | B1-Black (seat 2)
const COL_SEAT = [0, 1, 3, 2] as const; // column index → seat
const SEAT_COL = [0, 1, 3, 2] as const; // seat → column index

const SEAT_COLOR  = ['#56dbd3', '#ef5757', '#fbbf24', '#a78bfa'] as const; // col 0..3
const SEAT_BORDER = ['rgba(86,219,211,0.25)', 'rgba(239,87,87,0.25)', 'rgba(251,191,36,0.25)', 'rgba(167,139,250,0.25)'] as const;
const SEAT_BG     = ['rgba(86,219,211,0.10)', 'rgba(239,87,87,0.10)', 'rgba(251,191,36,0.10)', 'rgba(167,139,250,0.10)'] as const;

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${String(rem).padStart(2, '0')}s`;
}

// Compute row labels (A1, A1', B2, …) for each event in chronological order.
function buildLabels(events: GameEvent[]): string[] {
  const whiteMoveCount: [number, number] = [0, 0];
  return events.map((ev) => {
    const b = ev.boardId;
    const isWhite = ev.seat === 0 || ev.seat === 3;
    const letter = b === 0 ? 'A' : 'B';
    if (isWhite) {
      whiteMoveCount[b]++;
      return `${letter}${whiteMoveCount[b]}`;
    }
    return `${letter}${whiteMoveCount[b]}'`;
  });
}

export function CombinedNotationPanel({ events, initialClockMs, playerNames, highlightedIndex, onJumpToIndex, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const annotated = useMemo(
    () => buildSanList(events, initialClockMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events.length, initialClockMs],
  );

  const labels = useMemo(() => buildLabels(events), [events]);

  const startTs = events[0]?.ts ?? 0;

  useEffect(() => {
    if (highlightedIndex === null) {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [annotated.length, highlightedIndex]);

  useEffect(() => {
    if (highlightedIndex !== null && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Column widths: label | B0-W | B0-B | B1-W | B1-B
  const grid = '36px 1fr 1fr 1fr 1fr';

  // Player names per column (ordered by COL_SEAT).
  const colNames = COL_SEAT.map((s) => playerNames[s]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      height: height ?? 320,
      overflow: 'hidden',
    }}>

      {/* ── Board group headers ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `36px 1fr 1fr 1fr 1fr`,
        background: '#0d0f14',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div />
        {/* Left board label */}
        <div style={{
          gridColumn: '2 / 4',
          textAlign: 'center',
          padding: '5px 0 4px',
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}>
          Left Board
        </div>
        {/* Right board label */}
        <div style={{
          gridColumn: '4 / 6',
          textAlign: 'center',
          padding: '5px 0 4px',
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
        }}>
          Right Board
        </div>
      </div>

      {/* ── Player name headers ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: grid,
        background: '#0d0f14',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div />
        {colNames.map((name, ci) => (
          <div key={ci} style={{
            padding: '4px 6px 5px',
            fontFamily: "'Geist', 'Inter', sans-serif",
            fontSize: 11, fontWeight: 700,
            color: SEAT_COLOR[ci],
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            borderRight: ci === 1 ? '1px solid rgba(255,255,255,0.1)' : undefined,
            borderLeft: ci === 0 || ci === 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}>
            {name}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {annotated.length === 0 ? (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '12px 10px',
          }}>—</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: grid,
          }}>
            {annotated.map((a, i) => {
              const highlighted = i === highlightedIndex;
              const seat = a.event.seat;
              const col = SEAT_COL[seat]!;   // 0..3
              const elapsed = a.event.ts - startTs;
              const label = labels[i] ?? '';
              const rowBg = highlighted
                ? SEAT_BG[col]
                : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
              const accentColor = SEAT_COLOR[col]!;

              // Render 5 cells: label + 4 columns (only one has the move).
              return (
                <React.Fragment key={a.event.seq}>
                  {/* Row label */}
                  <div style={{
                    background: rowBg,
                    padding: '3px 6px 3px 8px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: 'rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    userSelect: 'none',
                  }}>
                    {label}
                  </div>

                  {/* 4 move columns */}
                  {([0, 1, 2, 3] as const).map((c) => {
                    const isMove = c === col;
                    return (
                      <div
                        key={c}
                        ref={isMove && highlighted ? highlightRef : undefined}
                        onClick={isMove ? () => onJumpToIndex(i) : undefined}
                        style={{
                          background: rowBg,
                          padding: '3px 6px',
                          borderLeft: c === 0 || c === 2 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                          borderRight: c === 1 ? '1px solid rgba(255,255,255,0.1)' : undefined,
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          cursor: isMove ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'baseline', gap: 3,
                          minHeight: 22,
                        }}
                      >
                        {isMove && (
                          <>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 13, fontWeight: highlighted ? 700 : 500,
                              color: highlighted ? accentColor : 'rgba(255,255,255,0.88)',
                            }}>
                              {a.san}
                            </span>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 9,
                              color: highlighted ? `${accentColor}99` : 'rgba(255,255,255,0.25)',
                            }}>
                              {formatElapsed(elapsed)}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
