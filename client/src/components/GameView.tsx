import React, { useCallback, useEffect, useState } from 'react';
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
import { PlayerStrip } from './PlayerStrip.js';
import { ChatPanel } from './ChatPanel.js';
import { legalMoves, inCheck, pseudoLegalMoves } from '../lib/legalMoves.js';

// Seating layout (desktop, two boards side by side):
//
//   Board 0                  Board 1
//   top:    Seat 1 (B0,Blk)  Seat 2 (B1,Blk)
//   bottom: Seat 0 (B0,Wht)  Seat 3 (B1,Wht)
//
// Partners: 0↔2, 1↔3  (same team, different boards)

type Props = {
  store: GameStore;
  send: (msg: any) => void;
};

export function GameView({ store, send }: Props) {
  const { game, yourSeat } = store;
  const [selectedPiece, setSelectedPiece] = useState<DropPieceType | null>(null);
  const [draggedHandPiece, setDraggedHandPiece] = useState<DropPieceType | null>(null);
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

  // For premove drops we don't know the future board state, so show any geometrically valid square.
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
    // Run the move generator on a board that only contains the moving piece so
    // that sliding pieces get full unblocked rays and the player can premove to
    // any geometrically reachable square (the board will look different when the
    // premove fires). The server re-validates on execution.
    const emptyBoard = boardState.board.map((_p, i) => i === fromSq ? piece : null);
    const fakeState = { ...boardState, board: emptyBoard, turn: myColor };
    const targets = new Set(
      pseudoLegalMoves(fakeState).filter((m) => m.from === fromSq).map((m) => m.to),
    );
    // Pawn diagonal squares: the empty board has no opponent pieces to capture,
    // so add both diagonals explicitly (covers en passant and future captures).
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

  // Fire queued premove when it becomes our turn.
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

  const handlePromoSelect = useCallback((diagonalSquare: Square) => {
    send({ type: 'promotion-select', diagonalSquare });
  }, [send]);

  const handlePromoCancel = useCallback(() => {
    send({ type: 'cancel-promotion' });
  }, [send]);

  const handleResign = useCallback(() => {
    if (window.confirm('Resign?')) send({ type: 'resign' });
  }, [send]);

  const handleRematch = useCallback(() => {
    send({ type: 'rematch' });
  }, [send]);

  const handleSendChat = useCallback((text: string) => {
    send({ type: 'chat', text });
  }, [send]);

  if (!game) return <div style={{ padding: 40 }}>Connecting…</div>;

  // Determine if we are in promotion-pick mode (only relevant for our own board).
  const myBoardId = yourSeat !== null ? seatBoard(yourSeat) : null;
  const inPromoMode = yourSeat !== null && myBoardId !== null &&
    game.boards[myBoardId].pendingPromotion?.color === seatColor(yourSeat);

  // The diagonal board for promotion picking.
  const diagBoardId = yourSeat !== null ? seatBoard(diagonalOf(yourSeat)) : null;
  const diagColor = yourSeat !== null ? seatColor(diagonalOf(yourSeat)) : null;

  function buildBoardInteraction(boardId: BoardId): BoardInteraction | null {
    if (!game || yourSeat === null) return null;
    if (game.status !== 'playing') return null;

    // Our own board in promotion-pick mode: no normal interaction.
    if (inPromoMode && boardId === myBoardId) return null;

    // Diagonal board in promotion-pick mode: show pick interaction.
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

  // Perspective: white sees their board from white's side.
  function boardPerspective(boardId: BoardId): Color {
    if (yourSeat === null) return 'w'; // spectator: white side up
    if (seatBoard(yourSeat) === boardId) return seatColor(yourSeat);
    // Partner's board: show from partner's perspective.
    return seatColor((yourSeat + 2) % 4 as Seat);
  }

  function buildBoardEl(boardId: BoardId, cellSize: number) {
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

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PlayerStrip seat={topSeat} store={store} isYou={yourSeat === topSeat} position="top" />
        <HandPanel
          hand={game!.hands[topSeat]}
          color={seatColor(topSeat)}
          selectedPiece={null}
          onSelect={() => {}}
          canInteract={false}
        />
        <Board
          board={board.board}
          perspective={perspective}
          interaction={interaction}
          pendingPromoSquare={pendingPromoSq}
          promotionPickColor={inPromoMode && boardId === diagBoardId ? diagColor! : undefined}
          label={`Board ${boardId + 1}`}
          premove={yourSeat !== null && seatBoard(yourSeat) === boardId ? premove : null}
          onCancelPremove={yourSeat !== null && seatBoard(yourSeat) === boardId ? () => setPremove(null) : undefined}
          cellSize={cellSize}
        />
        <HandPanel
          hand={game!.hands[handSeat]}
          color={seatColor(handSeat)}
          selectedPiece={isMyHand ? selectedPiece : null}
          onSelect={isMyHand ? (p) => { setSelectedPiece(p); setPremove(null); } : () => {}}
          canInteract={isMyHand && isYourTurn(boardId) && !inPromoMode}
          canDrag={isMyHand && game!.status === 'playing' && !inPromoMode}
          onDragStart={isMyHand ? (p) => { setDraggedHandPiece(p); setPremove(null); } : undefined}
          onDragEnd={isMyHand ? () => setDraggedHandPiece(null) : undefined}
        />
        <PlayerStrip seat={botSeat} store={store} isYou={yourSeat === botSeat} position="bottom" />
      </div>
    );
  }

  const ownBoardId: BoardId = myBoardId ?? 0;
  const partnerBoardId: BoardId = (1 - ownBoardId) as BoardId;

  const inCheckNotice = yourSeat !== null && game.status === 'playing' &&
    inCheck(game.boards[seatBoard(yourSeat)], seatColor(yourSeat));

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Error toasts */}
      {store.errors.map((e, i) => (
        <div key={i} style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
          {e}
        </div>
      ))}

      {/* Promotion pick prompt */}
      {inPromoMode && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', padding: '8px 16px', borderRadius: 6, marginBottom: 8, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Click a piece on Board {(diagBoardId ?? 0) + 1} to complete your promotion.</span>
          <button
            onClick={handlePromoCancel}
            style={{ padding: '2px 10px', background: '#fff', border: '1px solid #f59e0b', borderRadius: 4, cursor: 'pointer', fontWeight: 'normal', fontSize: 13 }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Check notice */}
      {inCheckNotice && !inPromoMode && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', padding: '6px 16px', borderRadius: 6, marginBottom: 8, fontWeight: 'bold', color: '#dc2626' }}>
          You are in check!
        </div>
      )}

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        {/* Main board (your board) — large */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buildBoardEl(ownBoardId, 72)}

          {/* Game controls below own board */}
          {game.status === 'ended' && game.result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {(() => {
                const isWin = yourSeat !== null && yourSeat % 2 === game.result!.winningTeam;
                return (
                  <div style={{
                    background: isWin ? '#f0fdf4' : '#fef2f2',
                    border: `2px solid ${isWin ? '#16a34a' : '#dc2626'}`,
                    padding: 12,
                    borderRadius: 8,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: isWin ? '#166534' : '#991b1b',
                  }}>
                    {yourSeat !== null && (isWin ? '🏆 Your team wins!' : 'Your team lost')}
                    <br />
                    <span style={{ fontSize: 12, fontWeight: 400 }}>
                      {game.result!.reason === 'king-capture' && 'King captured'}
                      {game.result!.reason === 'time' && 'Time out'}
                      {game.result!.reason === 'resign' && 'Resignation'}
                      {game.result!.reason === 'disconnect' && 'Disconnect'}
                    </span>
                  </div>
                );
              })()}
              {yourSeat !== null && (
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleRematch}
                    disabled={game.rematchVotes[yourSeat]}
                    style={{
                      padding: '8px 20px',
                      background: game.rematchVotes[yourSeat] ? '#d1fae5' : '#16a34a',
                      color: game.rematchVotes[yourSeat] ? '#065f46' : '#fff',
                      border: '1px solid #16a34a',
                      borderRadius: 6,
                      cursor: game.rematchVotes[yourSeat] ? 'default' : 'pointer',
                      fontWeight: 'bold',
                      width: '100%',
                    }}
                  >
                    {game.rematchVotes[yourSeat] ? 'Rematch requested…' : 'Rematch'}
                  </button>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    {([0, 1, 2, 3] as const).filter((s) => game.rematchVotes[s]).length}/4 players ready
                  </div>
                </div>
              )}
            </div>
          )}

          {game.status === 'playing' && yourSeat !== null && (
            <button
              onClick={handleResign}
              style={{ padding: '6px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
            >
              Resign
            </button>
          )}
        </div>

        {/* Right column: partner board (smaller) + chat below */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {buildBoardEl(partnerBoardId, 46)}
          <ChatPanel
            messages={store.chatMessages}
            onSend={handleSendChat}
            canSend={yourSeat !== null && game.status === 'playing'}
          />
        </div>
      </div>
    </div>
  );
}
