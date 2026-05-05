import {
  BoardState,
  Color,
  DropPieceType,
  Piece,
  PieceType,
  Square,
  fileOf,
  otherColor,
  rankOf,
  sq,
} from '../types.js';
import { cloneBoardState } from './board.js';
import { Move, hasLegalMove, inCheck } from './moves.js';

export type ApplyMoveResult = {
  state: BoardState;
  // The piece that was captured (if any). The bughouse layer is responsible
  // for converting wasPromoted captures to a pawn before crediting hand.
  captured: Piece | null;
  // True if the move is a pawn-to-last-rank that triggers the promotion-swap.
  // When true, the returned state has pendingPromotion set and turn has NOT
  // been switched.
  triggeredPromotion: boolean;
  // True if a king was captured by this move (terminal event).
  kingCaptured: boolean;
};

export function applyMove(state: BoardState, move: Move): ApplyMoveResult {
  if (state.pendingPromotion) {
    throw new Error('cannot move while promotion is pending');
  }
  const next = cloneBoardState(state);
  const b = next.board;
  const piece = b[move.from];
  if (!piece) throw new Error('no piece at from');
  if (piece.color !== state.turn) throw new Error('wrong color to move');

  let captured: Piece | null = null;
  if (move.enPassantCapture !== undefined) {
    captured = b[move.enPassantCapture] ?? null;
    b[move.enPassantCapture] = null;
  } else {
    captured = b[move.to] ?? null;
  }

  const kingCaptured = !!captured && captured.type === 'K';

  b[move.to] = piece;
  b[move.from] = null;

  if (move.castle === 'K') {
    const r = rankOf(move.to);
    b[sq(5, r)] = b[sq(7, r)] ?? null;
    b[sq(7, r)] = null;
  } else if (move.castle === 'Q') {
    const r = rankOf(move.to);
    b[sq(3, r)] = b[sq(0, r)] ?? null;
    b[sq(0, r)] = null;
  }

  updateCastlingRights(next, move, piece);

  next.enPassant = null;
  if (piece.type === 'P' && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    const dir = piece.color === 'w' ? 1 : -1;
    next.enPassant = sq(fileOf(move.from), rankOf(move.from) + dir);
  }

  if (captured || piece.type === 'P') {
    next.halfmoveClock = 0;
  } else {
    next.halfmoveClock += 1;
  }

  let triggeredPromotion = false;
  if (move.triggersPromotion) {
    triggeredPromotion = true;
    next.pendingPromotion = {
      from: move.from,
      to: move.to,
      color: piece.color,
    };
  } else {
    next.turn = otherColor(state.turn);
    if (next.turn === 'w') next.fullmoveNumber += 1;
  }

  return { state: next, captured, triggeredPromotion, kingCaptured };
}

function updateCastlingRights(state: BoardState, move: Move, mover: Piece): void {
  const r = state.castling;
  if (mover.type === 'K') {
    if (mover.color === 'w') { r.wK = false; r.wQ = false; }
    else { r.bK = false; r.bQ = false; }
  }
  if (mover.type === 'R') {
    if (mover.color === 'w') {
      if (move.from === sq(0, 0)) r.wQ = false;
      if (move.from === sq(7, 0)) r.wK = false;
    } else {
      if (move.from === sq(0, 7)) r.bQ = false;
      if (move.from === sq(7, 7)) r.bK = false;
    }
  }
  if (move.to === sq(0, 0)) r.wQ = false;
  if (move.to === sq(7, 0)) r.wK = false;
  if (move.to === sq(0, 7)) r.bQ = false;
  if (move.to === sq(7, 7)) r.bK = false;
}

// ---------------- Drops (low-level, no mate-by-drop check) ----------------

export type DropAttempt = {
  piece: DropPieceType;
  to: Square;
};

export type DropReason =
  | 'wrong-turn'
  | 'pending-promotion'
  | 'occupied'
  | 'pawn-rank'
  | 'no-piece-in-hand'
  | 'self-check'
  | 'mate-by-drop';

export class DropError extends Error {
  constructor(public reason: DropReason) {
    super(reason);
  }
}

// Validate and apply a drop, ignoring the mate-by-drop rule. Returns the
// resulting board state with turn switched. The bughouse wrapper layers
// mate-by-drop validation on top using opponent-hand awareness.
export function applyDropRaw(
  state: BoardState,
  color: Color,
  drop: DropAttempt,
  available: number,
): BoardState {
  if (state.turn !== color) throw new DropError('wrong-turn');
  if (state.pendingPromotion) throw new DropError('pending-promotion');
  if (state.board[drop.to]) throw new DropError('occupied');
  if (available <= 0) throw new DropError('no-piece-in-hand');
  if (drop.piece === 'P') {
    const r = rankOf(drop.to);
    if (r === 0 || r === 7) throw new DropError('pawn-rank');
  }

  const next = cloneBoardState(state);
  next.board[drop.to] = { type: drop.piece, color, wasPromoted: false };

  if (inCheck(next, color)) throw new DropError('self-check');

  next.turn = otherColor(color);
  if (next.turn === 'w') next.fullmoveNumber += 1;
  next.enPassant = null;
  next.halfmoveClock = 0;
  return next;
}

// ---------------- Promotion swap ----------------

export type PromotionSelection = {
  // Square on the diagonal opponent's board.
  diagonalSquare: Square;
};

export type PromotionReason =
  | 'no-pending'
  | 'empty-square'
  | 'invalid-piece'
  | 'wrong-color';

export class PromotionError extends Error {
  constructor(public reason: PromotionReason) {
    super(reason);
  }
}

// Replace the pawn at the promotion square with the chosen piece, switch turn.
// chosenType comes from what was taken on the diagonal board.
export function applyPromotionOnPromotingBoard(
  state: BoardState,
  chosenType: Exclude<PieceType, 'K' | 'P'>,
): BoardState {
  if (!state.pendingPromotion) throw new PromotionError('no-pending');
  const next = cloneBoardState(state);
  const { to, color } = next.pendingPromotion!;
  next.board[to] = { type: chosenType, color, wasPromoted: true };
  next.pendingPromotion = null;
  next.turn = otherColor(color);
  if (next.turn === 'w') next.fullmoveNumber += 1;
  next.enPassant = null;
  return next;
}

// Remove the chosen piece from the diagonal opponent's board.
export function applyPromotionOnDiagonalBoard(
  state: BoardState,
  selection: PromotionSelection,
): { state: BoardState; takenType: Exclude<PieceType, 'K' | 'P'> } {
  const next = cloneBoardState(state);
  const target = next.board[selection.diagonalSquare];
  if (!target) throw new PromotionError('empty-square');
  if (target.type === 'K' || target.type === 'P') throw new PromotionError('invalid-piece');
  next.board[selection.diagonalSquare] = null;
  if (selection.diagonalSquare === sq(0, 0)) next.castling.wQ = false;
  if (selection.diagonalSquare === sq(7, 0)) next.castling.wK = false;
  if (selection.diagonalSquare === sq(0, 7)) next.castling.bQ = false;
  if (selection.diagonalSquare === sq(7, 7)) next.castling.bK = false;
  return { state: next, takenType: target.type };
}

// ---------------- Helpers ----------------

export function isCheckmateMovesOnly(state: BoardState): boolean {
  return inCheck(state, state.turn) && !hasLegalMove(state);
}
