import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BoardId,
  Color,
  DropPieceType,
  Seat,
  Square,
  diagonalOf,
  fileOf,
  rankOf,
  seatBoard,
  seatColor,
  sq,
} from '@bughouse/shared';
import type { GameStore } from '../hooks/useGame.js';
import { Board, BoardInteraction, PremoveState } from './Board.js';
import { HandPanel } from './HandPanel.js';
import { ChessPiece, PieceType } from './ChessPiece.js';
import { PlayerStrip } from './PlayerStrip.js';
import { ChatPanel } from './ChatPanel.js';
import { legalMoves, pseudoLegalMoves } from '../lib/legalMoves.js';
import { COLOR_SCHEMES, ColorScheme, loadScheme, saveScheme } from '../themes.js';

type Props = {
  store: GameStore;
  send: (msg: any) => void;
};

function SectionLabel({ text, accent }: { text: string; accent: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 10px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
      color: accent,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: 3,
        background: accent,
        boxShadow: `0 0 8px ${accent}`,
      }} />
      {text}
    </div>
  );
}

function ThemePicker({
  current,
  onChange,
}: {
  current: ColorScheme;
  onChange: (s: ColorScheme) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Board theme"
        style={{
          width: 30, height: 30,
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 120ms',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 15,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        {/* palette icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: 'rgba(12,14,18,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            zIndex: 99,
            minWidth: 220,
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: 'rgba(255,255,255,0.35)',
              letterSpacing: 1.2, textTransform: 'uppercase',
              marginBottom: 12,
            }}>Board Colors</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_SCHEMES.map((scheme) => {
                const isActive = scheme.key === current.key;
                return (
                  <button
                    key={scheme.key}
                    title={scheme.label}
                    onClick={() => { onChange(scheme); setOpen(false); }}
                    style={{
                      width: 44, height: 44,
                      borderRadius: 7,
                      border: isActive
                        ? '2px solid #56dbd3'
                        : '2px solid rgba(255,255,255,0.1)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: '1fr 1fr',
                      boxShadow: isActive ? '0 0 0 3px rgba(86,219,211,0.25)' : 'none',
                      transition: 'border-color 120ms, box-shadow 120ms',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ background: scheme.light }} />
                    <div style={{ background: scheme.dark }} />
                    <div style={{ background: scheme.dark }} />
                    <div style={{ background: scheme.light }} />
                  </button>
                );
              })}
            </div>
            {/* Label for current selection */}
            <div style={{
              marginTop: 10,
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 11, color: 'rgba(255,255,255,0.45)',
            }}>
              {current.label}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GameHeader({
  onResign,
  canResign,
  gameCode,
  colorScheme,
  onColorScheme,
}: {
  onResign: () => void;
  canResign: boolean;
  gameCode?: string;
  colorScheme: ColorScheme;
  onColorScheme: (s: ColorScheme) => void;
}) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.01)',
      backdropFilter: 'blur(10px)',
      position: 'relative', zIndex: 5,
      flexShrink: 0,
    }}>
      {/* Logo + game info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26,
            background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0a0c10', fontSize: 14,
          }}>♞</div>
          <span style={{
            fontFamily: "'Geist', 'Inter', sans-serif",
            fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
          }}>BUGHOUSE</span>
        </div>
        {gameCode && (
          <>
            <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: 'rgba(255,255,255,0.35)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>Game</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13, color: '#56dbd3',
                fontWeight: 600, letterSpacing: 1,
              }}>{gameCode}</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThemePicker current={colorScheme} onChange={onColorScheme} />
        {canResign && (
          <button
            onClick={onResign}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#ff5757',
              padding: '7px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >RESIGN</button>
        )}
      </div>
    </header>
  );
}

function useBoardLayout() {
  const compute = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const h = typeof window !== 'undefined' ? window.innerHeight : 900;
    const chatWidth = Math.min(340, Math.max(240, Math.round(w * 0.20)));
    // horizontal: outer padding (24*2) + 2 column gaps (24*2) + chat
    const horizReserved = 48 + 48 + chatWidth;
    const cByWidth = Math.floor((w - horizReserved) / 16);
    // vertical: header(50) + notif(30) + main padding(40) + 2 strips(~96)
    //         + label(20) + gaps(30) + 2 hands(1.7c+24)
    // board = 8c. Total <= h  =>  c <= (h - 290) / 9.7
    const cByHeight = Math.floor((h - 290) / 9.7);
    const cellSize = Math.max(34, Math.min(82, Math.min(cByWidth, cByHeight)));
    return { cellSize, chatWidth };
  };

  const [layout, setLayout] = useState(compute);
  useEffect(() => {
    const onResize = () => setLayout(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return layout;
}

export function GameView({ store, send }: Props) {
  const { game, yourSeat } = store;
  const [colorScheme, setColorScheme] = useState<ColorScheme>(loadScheme);
  const { cellSize, chatWidth } = useBoardLayout();

  const handleColorScheme = useCallback((s: ColorScheme) => {
    setColorScheme(s);
    saveScheme(s);
  }, []);

  const [selectedPiece, setSelectedPiece] = useState<DropPieceType | null>(null);
  const [draggedHandPiece, setDraggedHandPiece] = useState<DropPieceType | null>(null);
  const [handDragPos, setHandDragPos] = useState<{ x: number; y: number } | null>(null);
  const handDragCleanupRef = useRef<(() => void) | null>(null);
  const [premove, setPremove] = useState<PremoveState | null>(null);

  const isYourTurn = useCallback((boardId: BoardId): boolean => {
    if (!game || yourSeat === null) return false;
    if (seatBoard(yourSeat) !== boardId) return false;
    const board = game.boards[boardId];
    if (board.pendingPromotion) return board.pendingPromotion.color === seatColor(yourSeat);
    return board.turn === seatColor(yourSeat);
  }, [game, yourSeat]);

  const getMoveLegalTargets = useCallback((boardId: BoardId, fromSq: Square): Set<Square> => {
    if (!game || yourSeat === null || !isYourTurn(boardId)) return new Set();
    const board = game.boards[boardId];
    const color = seatColor(yourSeat);
    const piece = board.board[fromSq];
    if (!piece || piece.color !== color) return new Set();
    return new Set(
      legalMoves(board)
        .filter((m) => m.from === fromSq)
        .map((m) => m.to),
    );
  }, [game, yourSeat, isYourTurn]);

  const getDropTargets = useCallback((boardId: BoardId, piece: DropPieceType): Set<Square> => {
    if (!game || yourSeat === null || !isYourTurn(boardId)) return new Set();
    const board = game.boards[boardId];
    const out = new Set<Square>();
    for (let s = 0; s < 64; s++) {
      if (board.board[s]) continue;
      if (piece === 'P') {
        const r = s >> 3;
        if (r === 0 || r === 7) continue;
      }
      out.add(s);
    }
    return out;
  }, [game, yourSeat, isYourTurn]);

  const getPremoveDropTargets = useCallback((piece: DropPieceType): Set<Square> => {
    const out = new Set<Square>();
    for (let s = 0; s < 64; s++) {
      if (piece === 'P') {
        const r = s >> 3;
        if (r === 0 || r === 7) continue;
      }
      out.add(s);
    }
    return out;
  }, []);

  const getPremoveTargets = useCallback((boardId: BoardId, fromSq: Square): Set<Square> => {
    if (!game || yourSeat === null) return new Set();
    const myColor = seatColor(yourSeat);
    const boardState = game.boards[boardId];
    const piece = boardState.board[fromSq];
    if (!piece || piece.color !== myColor) return new Set();
    const emptyBoard = boardState.board.map((_p, i) => i === fromSq ? piece : null);
    const fakeState = { ...boardState, board: emptyBoard, turn: myColor };
    const targets = new Set(
      pseudoLegalMoves(fakeState).filter((m) => m.from === fromSq).map((m) => m.to),
    );
    if (piece.type === 'P') {
      const dir = myColor === 'w' ? 1 : -1;
      const f = fileOf(fromSq);
      const r = rankOf(fromSq);
      for (const df of [-1, 1]) {
        const cf = f + df;
        const cr = r + dir;
        if (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) targets.add(sq(cf, cr));
      }
    }
    return targets;
  }, [game, yourSeat]);

  useEffect(() => {
    if (!game || yourSeat === null || !premove) return;
    if (game.status !== 'playing') { setPremove(null); return; }
    const boardId = seatBoard(yourSeat);
    const board = game.boards[boardId];
    if (board.pendingPromotion) return;
    if (board.turn !== seatColor(yourSeat)) return;
    if (premove.type === 'move') {
      send({ type: 'move', boardId, from: premove.from, to: premove.to });
    } else {
      send({ type: 'drop', boardId, piece: premove.piece, to: premove.to });
    }
    setPremove(null);
  }, [game, yourSeat, premove, send]);

  const handleMove = useCallback((boardId: BoardId, from: Square, to: Square) => {
    send({ type: 'move', boardId, from, to });
    setSelectedPiece(null);
  }, [send]);

  const handleDrop = useCallback((boardId: BoardId, to: Square) => {
    const piece = selectedPiece ?? draggedHandPiece;
    if (piece === null) return;
    send({ type: 'drop', boardId, piece, to });
    setSelectedPiece(null);
    setDraggedHandPiece(null);
  }, [send, selectedPiece, draggedHandPiece]);

  // Called by HandPanel when a drag starts (movement threshold exceeded).
  // Registers global pointer handlers to show a floating piece and execute
  // the drop via elementFromPoint when the pointer is released.
  const handleHandDragStart = useCallback((piece: DropPieceType) => {
    // Clean up any previous stale drag
    handDragCleanupRef.current?.();

    setDraggedHandPiece(piece);
    setSelectedPiece(null);
    setPremove(null);

    const boardId = yourSeat !== null ? seatBoard(yourSeat) : null;

    const onMove = (e: PointerEvent) => {
      setHandDragPos({ x: e.clientX, y: e.clientY });
    };

    const onUp = (e: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      handDragCleanupRef.current = null;
      setDraggedHandPiece(null);
      setHandDragPos(null);

      if (boardId === null) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const squareEl = (el as HTMLElement | null)?.closest('[data-square]') as HTMLElement | null;
      if (!squareEl) return;
      const toSq = parseInt(squareEl.dataset.square ?? '');
      if (!isNaN(toSq)) {
        send({ type: 'drop', boardId, piece, to: toSq });
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
    handDragCleanupRef.current = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [yourSeat, send]);

  // Clean up lingering hand-drag listeners on unmount
  useEffect(() => () => { handDragCleanupRef.current?.(); }, []);

  const handlePromoSelect = useCallback((diagonalSquare: Square) => {
    send({ type: 'promotion-select', diagonalSquare });
  }, [send]);

  const handlePromoCancel = useCallback(() => {
    send({ type: 'cancel-promotion' });
  }, [send]);

  const handleResign = useCallback(() => {
    if (window.confirm('Resign the game? This will end the game for both you and your partner.')) {
      send({ type: 'resign' });
    }
  }, [send]);

  const handleRematch = useCallback(() => {
    send({ type: 'rematch' });
  }, [send]);

  const handleSendChat = useCallback((text: string) => {
    send({ type: 'chat', text });
  }, [send]);

  if (!game) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Geist', 'Inter', sans-serif",
        color: 'rgba(255,255,255,0.4)',
      }}>
        Connecting…
      </div>
    );
  }

  const myBoardId = yourSeat !== null ? seatBoard(yourSeat) : null;
  const inPromoMode = yourSeat !== null && myBoardId !== null &&
    game.boards[myBoardId].pendingPromotion?.color === seatColor(yourSeat);

  const diagBoardId = yourSeat !== null ? seatBoard(diagonalOf(yourSeat)) : null;
  const diagColor = yourSeat !== null ? seatColor(diagonalOf(yourSeat)) : null;

  function buildBoardInteraction(boardId: BoardId): BoardInteraction | null {
    if (!game || yourSeat === null) return null;
    if (game.status !== 'playing') return null;

    if (inPromoMode && boardId === myBoardId) return null;

    if (inPromoMode && boardId === diagBoardId) {
      return { mode: 'promotion-pick', onPick: handlePromoSelect, onCancel: handlePromoCancel };
    }

    if (seatBoard(yourSeat) !== boardId) return null;

    const activePiece = selectedPiece ?? draggedHandPiece;

    if (!isYourTurn(boardId)) {
      if (game.boards[boardId].pendingPromotion) return null;
      if (activePiece !== null) {
        return {
          mode: 'drop',
          piece: activePiece,
          dropTargets: getPremoveDropTargets(activePiece),
          onDrop: (to) => {
            setPremove({ type: 'drop', piece: activePiece, to });
            setSelectedPiece(null);
            setDraggedHandPiece(null);
          },
        };
      }
      return {
        mode: 'move',
        onMove: (from, to) => setPremove({ type: 'move', from, to }),
        getTargets: (from) => getPremoveTargets(boardId, from),
      };
    }

    if (activePiece !== null) {
      return {
        mode: 'drop',
        piece: activePiece,
        dropTargets: getDropTargets(boardId, activePiece),
        onDrop: (to) => handleDrop(boardId, to),
      };
    }
    return {
      mode: 'move',
      onMove: (from, to) => handleMove(boardId, from, to),
      getTargets: (from) => getMoveLegalTargets(boardId, from),
    };
  }

  function boardPerspective(boardId: BoardId): Color {
    if (yourSeat === null) return 'w';
    if (seatBoard(yourSeat) === boardId) return seatColor(yourSeat);
    return seatColor((yourSeat + 2) % 4 as Seat);
  }

  function buildBoardEl(boardId: BoardId, cellSize: number, large = false) {
    const board = game!.boards[boardId];
    const perspective = boardPerspective(boardId);

    const topColor: Color = perspective === 'w' ? 'b' : 'w';
    const topSeat: Seat = boardId === 0 ? (topColor === 'w' ? 0 : 1) : (topColor === 'w' ? 3 : 2);
    const botSeat: Seat = boardId === 0 ? (perspective === 'w' ? 0 : 1) : (perspective === 'w' ? 3 : 2);

    const interaction = buildBoardInteraction(boardId);
    const pendingPromoSq = board.pendingPromotion?.to ?? null;
    const isMyBoard = yourSeat !== null && seatBoard(yourSeat) === boardId;
    const handSeat = isMyBoard ? yourSeat! : botSeat;
    const isMyHand = isMyBoard && yourSeat !== null;

    const stripStyle = {
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Top player card */}
        <div style={{ ...stripStyle, borderRadius: 8 }}>
          <PlayerStrip seat={topSeat} store={store} isYou={yourSeat === topSeat} position="top" large={large} />
          <HandPanel
            hand={game!.hands[topSeat]}
            color={seatColor(topSeat)}
            selectedPiece={null}
            onSelect={() => {}}
            canInteract={false}
            large={large}
            cellSize={cellSize}
            colorScheme={colorScheme}
          />
        </div>

        <Board
          board={board.board}
          perspective={perspective}
          interaction={interaction}
          pendingPromoSquare={pendingPromoSq}
          promotionPickColor={inPromoMode && boardId === diagBoardId ? diagColor! : undefined}
          premove={yourSeat !== null && seatBoard(yourSeat) === boardId ? premove : null}
          onCancelPremove={yourSeat !== null && seatBoard(yourSeat) === boardId ? () => setPremove(null) : undefined}
          cellSize={cellSize}
          colorScheme={colorScheme}
          lastMove={board.lastMove}
        />

        {/* Bottom player card */}
        <div style={{ ...stripStyle, borderRadius: 8 }}>
          <HandPanel
            hand={game!.hands[handSeat]}
            color={seatColor(handSeat)}
            selectedPiece={isMyHand ? selectedPiece : null}
            onSelect={isMyHand ? (p) => { setSelectedPiece(p); setPremove(null); } : () => {}}
            canInteract={isMyHand && isYourTurn(boardId) && !inPromoMode}
            canDrag={isMyHand && game!.status === 'playing' && !inPromoMode}
            onDragStart={isMyHand ? handleHandDragStart : undefined}
            onDragEnd={isMyHand ? () => setDraggedHandPiece(null) : undefined}
            large={large}
            cellSize={cellSize}
            colorScheme={colorScheme}
          />
          <PlayerStrip seat={botSeat} store={store} isYou={yourSeat === botSeat} position="bottom" large={large} />
        </div>
      </div>
    );
  }

  const ownBoardId: BoardId = myBoardId ?? 0;
  const partnerBoardId: BoardId = (1 - ownBoardId) as BoardId;

  const isEnded = game.status === 'ended' && game.result;
  const isWin = isEnded && yourSeat !== null && yourSeat % 2 === game.result!.winningTeam;

  const REASON_LABEL: Record<string, string> = {
    'king-capture': 'King captured',
    'checkmate': 'Checkmate',
    'time': 'Time out',
    'resign': 'Resignation',
    'disconnect': 'Disconnect',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c10',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 25% 30%, rgba(86,219,211,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(167,139,250,0.04) 0%, transparent 50%)',
      }} />

      <GameHeader
        onResign={handleResign}
        canResign={yourSeat !== null && game.status === 'playing'}
        gameCode={undefined}
        colorScheme={colorScheme}
        onColorScheme={handleColorScheme}
      />


      {/* Main boards area */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 24,
        padding: '12px 24px 24px',
        position: 'relative', zIndex: 1,
        flexWrap: 'wrap',
      }}>
        {/* My board column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <SectionLabel text="MY BOARD" accent="#56dbd3" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {buildBoardEl(ownBoardId, cellSize, true)}
          </div>
        </div>

        {/* Chat column (between boards) */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: 'stretch',
          width: chatWidth,
          marginTop: 28,
        }}>
          <ChatPanel
            messages={store.chatMessages}
            onSend={handleSendChat}
            canSend={yourSeat !== null && game.status === 'playing'}
          />

          {/* Result + rematch */}
          {isEnded && (
            <div style={{
              background: isWin ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${isWin ? 'rgba(52,211,153,0.35)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: 10,
              padding: 16,
              textAlign: 'center',
            }}>
              {yourSeat !== null && (
                <div style={{
                  fontFamily: "'Geist', 'Inter', sans-serif",
                  fontSize: 16, fontWeight: 700,
                  color: isWin ? '#34d399' : '#ff7070',
                  marginBottom: 4,
                }}>
                  {isWin ? 'Your team wins!' : 'Your team lost'}
                </div>
              )}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, color: 'rgba(255,255,255,0.4)',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: yourSeat !== null ? 14 : 0,
              }}>
                {REASON_LABEL[game.result!.reason] ?? game.result!.reason}
              </div>
              {yourSeat !== null && (
                <>
                  <button
                    onClick={handleRematch}
                    disabled={game.rematchVotes[yourSeat]}
                    style={{
                      display: 'block', width: '100%',
                      padding: '9px 0',
                      background: game.rematchVotes[yourSeat] ? 'rgba(52,211,153,0.15)' : '#34d399',
                      color: game.rematchVotes[yourSeat] ? '#34d399' : '#0a0c10',
                      border: `1px solid ${game.rematchVotes[yourSeat] ? 'rgba(52,211,153,0.3)' : '#34d399'}`,
                      borderRadius: 7,
                      cursor: game.rematchVotes[yourSeat] ? 'default' : 'pointer',
                      fontFamily: "'Geist', 'Inter', sans-serif",
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {game.rematchVotes[yourSeat] ? 'Waiting for others…' : 'Rematch'}
                  </button>
                  <div style={{
                    marginTop: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: 'rgba(255,255,255,0.3)',
                    letterSpacing: 0.5,
                  }}>
                    {([0, 1, 2, 3] as const).filter((s) => game.rematchVotes[s]).length}/4 ready
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Partner board column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <SectionLabel text="PARTNER BOARD" accent="#a78bfa" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {buildBoardEl(partnerBoardId, cellSize, true)}
          </div>
        </div>
      </main>

      {/* Floating piece during hand-piece drag */}
      {draggedHandPiece && handDragPos && yourSeat !== null && (() => {
        const dragSize = Math.round(cellSize * 0.95);
        return (
          <div style={{
            position: 'fixed',
            left: handDragPos.x - dragSize / 2,
            top: handDragPos.y - dragSize / 2,
            width: dragSize,
            height: dragSize,
            pointerEvents: 'none',
            zIndex: 1000,
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
            willChange: 'transform',
          }}>
            <ChessPiece
              piece={draggedHandPiece as PieceType}
              color={seatColor(yourSeat)}
              size={dragSize}
            />
          </div>
        );
      })()}
    </div>
  );
}
