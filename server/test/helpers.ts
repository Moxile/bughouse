import { BoardState, GameState, Piece, PieceType, Color, Square, sq, emptyHand } from '@bughouse/shared';
import { emptyBoard, startingBoardState } from '../src/engine/board.js';
import { createGameState } from '../src/engine/game.js';

// Build a custom GameState by piece placement notation. Useful for testing.
//
// Squares are 0-indexed: file 0 = a, rank 0 = white's first rank.

export function P(type: PieceType, color: Color, wasPromoted = false): Piece {
  return { type, color, wasPromoted };
}

export function makeBoard(
  pieces: Array<[Piece, Square]>,
  opts: Partial<Omit<BoardState, 'board'>> = {},
): BoardState {
  const board = emptyBoard();
  for (const [p, s] of pieces) board[s] = p;
  return {
    board,
    turn: opts.turn ?? 'w',
    castling: opts.castling ?? { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: opts.enPassant ?? null,
    pendingPromotion: opts.pendingPromotion ?? null,
    halfmoveClock: opts.halfmoveClock ?? 0,
    fullmoveNumber: opts.fullmoveNumber ?? 1,
  };
}

export function emptyGame(code = 'TEST'): GameState {
  const gs = createGameState(code, 0);
  gs.boards = [
    makeBoard([], { turn: 'w' }),
    makeBoard([], { turn: 'w' }),
  ];
  gs.status = 'playing';
  return gs;
}

export function startingGame(code = 'TEST'): GameState {
  const gs = createGameState(code, 0);
  gs.status = 'playing';
  return gs;
}

// Square helpers using algebraic-ish notation.
// e2 -> file 4, rank 1.
export function S(alg: string): Square {
  const f = alg.charCodeAt(0) - 'a'.charCodeAt(0);
  const r = parseInt(alg[1]!, 10) - 1;
  return sq(f, r);
}
