// SAN (Standard Algebraic Notation) generation for the bughouse event log.
//
// Replays the event journal against a fresh GameState, generating one SAN
// string per event. Bughouse-specific extensions:
//   - Drops:      `P@e5`, `N@f3` (piece-at-square)
//   - Promotions: `e8=Q` / `gxh8=Q` (the piece taken from the diagonal board
//                 is appended; the promotion-source square is intentionally
//                 not encoded — it's recoverable from the event)
// Standard rules for everything else: castling (O-O / O-O-O), captures,
// disambiguation, en passant, check (+), mate / king-capture (#).

import { GameEvent } from './events.js';
import { BoardState, Color, PieceType, Square } from './types.js';
import { applyGameDrop, applyGameMove, applyGamePromotion, createGameState } from './engine/game.js';
import { inCheck, legalMoves } from './engine/moves.js';

export type AnnotatedEvent = {
  event: GameEvent;
  san: string;
};

export function buildSanList(events: GameEvent[], initialClockMs: number): AnnotatedEvent[] {
  const gs = createGameState('replay', 0, initialClockMs);
  const out: AnnotatedEvent[] = [];

  for (const ev of events) {
    let san: string;

    if (ev.kind === 'drop') {
      san = `${ev.piece}@${sqToAlg(ev.to)}`;
      try { applyGameDrop(gs, ev.seat, { piece: ev.piece, to: ev.to }); } catch {}
    } else {
      const board = gs.boards[ev.boardId];
      const piece = board.board[ev.from];
      const targetBefore = board.board[ev.to];

      if (!piece) {
        // Defensive fallback if the journal is somehow inconsistent.
        san = `${sqToAlg(ev.from)}-${sqToAlg(ev.to)}`;
      } else {
        const fileFrom = ev.from & 7;
        const fileTo = ev.to & 7;
        const isCastle = piece.type === 'K' && Math.abs(fileTo - fileFrom) === 2;
        if (isCastle) {
          san = fileTo > fileFrom ? 'O-O' : 'O-O-O';
        } else {
          // En passant: pawn moves diagonally onto an empty square.
          const isCapture = !!targetBefore
            || (piece.type === 'P' && fileFrom !== fileTo && !targetBefore);
          if (piece.type === 'P') {
            san = isCapture
              ? `${fileLetter(ev.from)}x${sqToAlg(ev.to)}`
              : sqToAlg(ev.to);
          } else {
            const dis = disambiguation(board, ev.from, ev.to, piece.type, piece.color);
            san = `${piece.type}${dis}${isCapture ? 'x' : ''}${sqToAlg(ev.to)}`;
          }
        }
      }

      try {
        applyGameMove(gs, ev.seat, { from: ev.from, to: ev.to });
        if (ev.promotedTo) {
          applyGamePromotion(gs, ev.seat, ev.promotedFromSquare!);
          san += `=${ev.promotedTo}`;
        }
      } catch {}
    }

    // Check / mate / king-capture suffix.
    if (gs.status === 'ended') {
      san += '#';
    } else if (inCheck(gs.boards[ev.boardId], gs.boards[ev.boardId].turn)) {
      san += '+';
    }

    out.push({ event: ev, san });
  }

  return out;
}

// Find the smallest disambiguator (file letter, rank digit, or full square)
// needed to distinguish the moving piece from any other same-type/colour piece
// of this side that could also legally reach `to`.
function disambiguation(
  board: BoardState,
  from: Square,
  to: Square,
  pieceType: PieceType,
  color: Color,
): string {
  const others: Square[] = [];
  for (const m of legalMoves(board)) {
    if (m.from === from || m.to !== to) continue;
    const p = board.board[m.from];
    if (!p || p.type !== pieceType || p.color !== color) continue;
    if (!others.includes(m.from)) others.push(m.from);
  }
  if (others.length === 0) return '';
  const fromFile = from & 7;
  const fromRank = from >> 3;
  const sameFile = others.some((s) => (s & 7) === fromFile);
  const sameRank = others.some((s) => (s >> 3) === fromRank);
  if (!sameFile) return fileLetter(from);
  if (!sameRank) return rankDigit(from);
  return sqToAlg(from);
}

function sqToAlg(sq: Square): string {
  return String.fromCharCode(97 + (sq & 7)) + ((sq >> 3) + 1);
}
function fileLetter(sq: Square): string {
  return String.fromCharCode(97 + (sq & 7));
}
function rankDigit(sq: Square): string {
  return String((sq >> 3) + 1);
}
