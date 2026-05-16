import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GameDetail,
  GameEvent,
  Seat,
  applyGameDrop,
  applyGameMove,
  applyGamePromotion,
  createGameState,
} from '@bughouse/shared';
import { Board } from './Board.js';
import { HandPanel } from './HandPanel.js';
import { ReplayPlayerStrip } from './ReplayPlayerStrip.js';
import { CombinedNotationPanel } from './CombinedNotationPanel.js';
import { TopBar } from './TopBar.js';
import { loadScheme } from '../themes.js';
import { loadPieceSet } from '../pieceSets.js';

type Props = {
  gameId: string;
  onHome: () => void;
  onBack: () => void;
};

// Reconstruct clock states for every step:
// clocks[k] = clock ms for each seat AFTER events[k-1] has been applied.
// clocks[0] = initial (before any moves).
function buildClockStates(events: GameEvent[], initialClockMs: number, startedAt: number): Record<Seat, number>[] {
  const states: Record<Seat, number>[] = [];
  const clocks: Record<Seat, number> = { 0: initialClockMs, 1: initialClockMs, 2: initialClockMs, 3: initialClockMs };
  // Per-board: timestamp when the current player's turn began.
  const turnStart: [number, number] = [startedAt, startedAt];

  states.push({ ...clocks });

  for (const ev of events) {
    const elapsed = ev.ts - turnStart[ev.boardId];
    clocks[ev.seat] = Math.max(0, clocks[ev.seat] - elapsed);
    turnStart[ev.boardId] = ev.ts;
    states.push({ ...clocks });
  }

  return states;
}

// Replay events[0..upToIndex] onto a fresh GameState.
function replayTo(events: GameEvent[], initialClockMs: number, upToIndex: number) {
  const gs = createGameState('replay', 0, initialClockMs);
  for (let i = 0; i <= upToIndex; i++) {
    const ev = events[i];
    if (!ev) break;
    try {
      if (ev.kind === 'move') {
        applyGameMove(gs, ev.seat, { from: ev.from, to: ev.to });
        if (ev.promotedTo && ev.promotedFromSquare !== undefined) {
          applyGamePromotion(gs, ev.seat, ev.promotedFromSquare);
        }
      } else {
        applyGameDrop(gs, ev.seat, { piece: ev.piece, to: ev.to });
      }
    } catch {}
  }
  return gs;
}

function getLastMove(events: GameEvent[], upToIndex: number, boardId: 0 | 1) {
  for (let i = upToIndex; i >= 0; i--) {
    const ev = events[i];
    if (ev && ev.boardId === boardId && ev.kind === 'move') {
      return { from: ev.from, to: ev.to };
    }
  }
  return null;
}

// Compute board cell size so both boards + notation fit the viewport without scrolling.
// Layout: [padding 16px] [board0] [gap 16px] [board1] [gap 16px] [notation ≥260px] [padding 16px]
function computeCellSize(): number {
  const pad = 32;   // 16px each side
  const gaps = 32;  // 16px × 2 gaps
  const notationMin = 260;
  const raw = Math.floor((window.innerWidth - pad - gaps - notationMin) / 16);
  return Math.max(34, Math.min(65, raw));
}

export function GameReplayPage({ gameId, onHome, onBack }: Props) {
  const [detail, setDetail] = useState<GameDetail | 'loading' | 'not-found'>('loading');
  const [step, setStep] = useState<number>(-1); // -1 = start position, 0..n-1 = after event[step]
  const [flipped, setFlipped] = useState(false);
  const [cellSize, setCellSize] = useState(computeCellSize);

  useEffect(() => {
    const onResize = () => setCellSize(computeCellSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const colorScheme = loadScheme();
  const pieceSet = loadPieceSet();

  useEffect(() => {
    setDetail('loading');
    setStep(-1);
    fetch(`/api/games/${encodeURIComponent(gameId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: GameDetail | null) => setDetail(data ?? 'not-found'))
      .catch(() => setDetail('not-found'));
  }, [gameId]);

  const events = detail !== 'loading' && detail !== 'not-found' ? detail.events : [];
  const eventCount = events.length;

  const clockStates = useMemo(() => {
    if (detail === 'loading' || detail === 'not-found') return [];
    return buildClockStates(detail.events, detail.initialClockMs, detail.startedAt);
  }, [detail]);

  const gameState = useMemo(() => {
    if (detail === 'loading' || detail === 'not-found') return null;
    if (step === -1) return createGameState('replay', 0, detail.initialClockMs);
    return replayTo(detail.events, detail.initialClockMs, step);
  }, [detail, step]);

  const clocks = clockStates[step + 1] ?? clockStates[0];

  const lastMoveB0 = useMemo(() => {
    if (!events.length || step < 0) return null;
    return getLastMove(events, step, 0);
  }, [events, step]);

  const lastMoveB1 = useMemo(() => {
    if (!events.length || step < 0) return null;
    return getLastMove(events, step, 1);
  }, [events, step]);

  // Keyboard navigation.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(-1, s - 1));
      if (e.key === 'ArrowRight') setStep((s) => Math.min(eventCount - 1, s + 1));
      if (e.key === 'Home') setStep(-1);
      if (e.key === 'End') setStep(eventCount - 1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [eventCount]);

  if (detail === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0c10', color: '#fff',
        display: 'flex', flexDirection: 'column', fontFamily: "'Geist', 'Inter', sans-serif",
      }}>
        <TopBar onHome={onHome} username={null} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (detail === 'not-found') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0c10', color: '#fff',
        display: 'flex', flexDirection: 'column', fontFamily: "'Geist', 'Inter', sans-serif",
      }}>
        <TopBar onHome={onHome} username={null} />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>♟</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Game not found</div>
          <button
            onClick={onBack}
            style={{
              background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
              border: 'none', color: '#0a0c10', borderRadius: 8,
              padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >← Back</button>
        </div>
      </div>
    );
  }

  // Capture narrowed GameDetail in a local const so inner functions can use it safely.
  const d = detail;
  const { playerNames, ratingChanges, initialClockMs: gameInitialClockMs, result, rated } = d;

  function ratingDelta(seat: Seat): number | null {
    return ratingChanges?.[seat]?.delta ?? null;
  }

  const board0 = gameState?.boards[0] ?? createGameState('replay', 0, gameInitialClockMs).boards[0];
  const board1 = gameState?.boards[1] ?? createGameState('replay', 0, gameInitialClockMs).boards[1];

  function BoardPanel({ boardId, whiteSeat, blackSeat }: {
    boardId: 0 | 1;
    whiteSeat: Seat;
    blackSeat: Seat;
  }) {
    const board = boardId === 0 ? board0 : board1;
    const lastMove = boardId === 0 ? lastMoveB0 : lastMoveB1;
    const whiteHand = gameState?.hands[whiteSeat] ?? { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    const blackHand = gameState?.hands[blackSeat] ?? { P: 0, N: 0, B: 0, R: 0, Q: 0 };

    // Board 1 mirrors the live partner board: default is black-at-bottom (seat 2's perspective).
    const effectiveFlipped = boardId === 1 ? !flipped : flipped;
    const perspective = effectiveFlipped ? 'b' : 'w';
    const topSeat    = effectiveFlipped ? whiteSeat : blackSeat;
    const bottomSeat = effectiveFlipped ? blackSeat : whiteSeat;
    const topHand    = effectiveFlipped ? whiteHand : blackHand;
    const bottomHand = effectiveFlipped ? blackHand : whiteHand;
    const topColor   = effectiveFlipped ? 'w' : 'b';
    const bottomColor = effectiveFlipped ? 'b' : 'w';

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        width: cellSize * 8,
      }}>
        {/* Top player */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
        }}>
          <ReplayPlayerStrip
            seat={topSeat}
            name={playerNames[topSeat]}
            ratingDelta={ratingDelta(topSeat)}
            clockMs={clocks?.[topSeat] ?? gameInitialClockMs}
            position="top"
          />
          <HandPanel
            hand={topHand}
            color={topColor}
            selectedPiece={null}
            onSelect={() => {}}
            canInteract={false}
            canDrag={false}
            cellSize={Math.round(cellSize * 0.55)}
            colorScheme={colorScheme}
            pieceSet={pieceSet}
          />
        </div>

        {/* Board */}
        <Board
          board={board.board}
          perspective={perspective}
          interaction={null}
          lastMove={lastMove}
          cellSize={cellSize}
          colorScheme={colorScheme}
          pieceSet={pieceSet}
        />

        {/* Bottom player */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
        }}>
          <HandPanel
            hand={bottomHand}
            color={bottomColor}
            selectedPiece={null}
            onSelect={() => {}}
            canInteract={false}
            canDrag={false}
            cellSize={Math.round(cellSize * 0.55)}
            colorScheme={colorScheme}
            pieceSet={pieceSet}
          />
          <ReplayPlayerStrip
            seat={bottomSeat}
            name={playerNames[bottomSeat]}
            ratingDelta={ratingDelta(bottomSeat)}
            clockMs={clocks?.[bottomSeat] ?? gameInitialClockMs}
            position="bottom"
          />
        </div>
      </div>
    );
  }

  const progress = eventCount > 0 ? (step + 1) / eventCount : 0;

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0c10', color: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 20% 30%, rgba(86,219,211,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(167,139,250,0.04) 0%, transparent 50%)',
      }} />
      <TopBar onHome={onHome} username={null} />

      <main style={{
        flex: 1, position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '16px 16px 40px',
        boxSizing: 'border-box',
      }}>

        {/* Back + Flip */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(86,219,211,0.08)', border: '1px solid rgba(86,219,211,0.2)',
              color: '#56dbd3', borderRadius: 8, padding: '7px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >← Back</button>
          <button
            onClick={() => setFlipped((f) => !f)}
            title="Flip both boards"
            style={{
              background: flipped ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
              border: flipped ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.12)',
              color: flipped ? '#a78bfa' : 'rgba(255,255,255,0.55)',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >⇅ Flip boards</button>
        </div>

        {/* Both boards + notation */}
        <div style={{
          display: 'flex', gap: 16, alignItems: 'flex-start',
          width: '100%',
        }}>
          <BoardPanel boardId={0} whiteSeat={0} blackSeat={1} />
          <BoardPanel boardId={1} whiteSeat={3} blackSeat={2} />

          {/* Right: notation + controls */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CombinedNotationPanel
              events={detail.events}
              initialClockMs={detail.initialClockMs}
              playerNames={[playerNames[0], playerNames[1], playerNames[2], playerNames[3]]}
              highlightedIndex={step >= 0 ? step : null}
              onJumpToIndex={(i) => setStep(i)}
              height={cellSize * 8 + 96}
            />

            {/* Step controls */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ControlBtn onClick={() => setStep(-1)} label="⏮" title="Start (Home)" disabled={step === -1} />
              <ControlBtn onClick={() => setStep((s) => Math.max(-1, s - 1))} label="◀" title="Previous (←)" disabled={step === -1} />
              <div style={{
                flex: 1, height: 4, background: 'rgba(255,255,255,0.08)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', background: '#56dbd3',
                  width: `${progress * 100}%`, transition: 'width 0.1s',
                  borderRadius: 2,
                }} />
              </div>
              <ControlBtn onClick={() => setStep((s) => Math.min(eventCount - 1, s + 1))} label="▶" title="Next (→)" disabled={step === eventCount - 1} />
              <ControlBtn onClick={() => setStep(eventCount - 1)} label="⏭" title="End (End)" disabled={step === eventCount - 1} />
            </div>

            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center',
            }}>
              Move {step + 1} / {eventCount} · ← → Home End
            </div>

            {/* Result */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#56dbd3' }}>
                Team {result.winningTeam === 0 ? `${playerNames[0]} & ${playerNames[2]}` : `${playerNames[1]} & ${playerNames[3]}`} won
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: 'rgba(255,255,255,0.35)',
              }}>
                by {result.reason} · {rated ? 'rated' : 'unrated'}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ControlBtn({ onClick, label, title, disabled }: {
  onClick: () => void;
  label: string;
  title: string;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
        borderRadius: 6, padding: '5px 10px',
        fontSize: 14, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}
