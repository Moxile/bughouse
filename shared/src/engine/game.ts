import {
  BoardId,
  BoardState,
  Color,
  DropPieceType,
  GameState,
  Hand,
  Hands,
  PieceType,
  Seat,
  Square,
  diagonalOf,
  emptyHand,
  partnerOf,
  rankOf,
  seatBoard,
  seatColor,
  teamOf,
} from '../types.js';
import { startingBoardState } from './board.js';
import {
  ApplyMoveResult,
  DropAttempt,
  DropError,
  applyDropRaw,
  applyMove,
  applyPromotionOnDiagonalBoard,
  applyPromotionOnPromotingBoard,
  cancelPromotion,
} from './apply.js';
import { Move, hasLegalMove, inCheck, pseudoLegalMoves } from './moves.js';

export const INITIAL_CLOCK_MS = 5 * 60 * 1000;

export function createGameState(code: string, now: number): GameState {
  return {
    code,
    status: 'lobby',
    boards: [startingBoardState(), startingBoardState()],
    hands: {
      0: emptyHand(),
      1: emptyHand(),
      2: emptyHand(),
      3: emptyHand(),
    } satisfies Hands,
    clocks: {
      0: INITIAL_CLOCK_MS,
      1: INITIAL_CLOCK_MS,
      2: INITIAL_CLOCK_MS,
      3: INITIAL_CLOCK_MS,
    },
    lastClockUpdate: 0,
    result: null,
    startedAt: null,
    initialClockMs: INITIAL_CLOCK_MS,
    rematchVotes: { 0: false, 1: false, 2: false, 3: false },
  };
}

// ---------------- Move ----------------

export type MoveOutcome = {
  triggeredPromotion: boolean;
  kingCaptured: boolean;
  capturedToPartnerHand: DropPieceType | null;
};

// Apply a move on `boardId`. Validates that `seat` is the side-to-move on
// that board. Transfers any captured piece to the partner's hand as-is.
// Throws on illegal moves.
export function applyGameMove(
  gs: GameState,
  seat: Seat,
  move: Move,
): MoveOutcome {
  const boardId = seatBoard(seat);
  const expectedColor = seatColor(seat);
  const board = gs.boards[boardId];
  if (board.turn !== expectedColor) {
    throw new MoveError('not-your-turn');
  }
  if (board.pendingPromotion) {
    throw new MoveError('pending-promotion');
  }
  const piece = board.board[move.from];
  if (!piece || piece.color !== expectedColor) {
    throw new MoveError('no-piece');
  }

  // Verify this is a legal move (in our generator) by matching against
  // legal moves. This catches off-board, wrong shape, blocked path, etc.
  const matched = pseudoLegalMoves(board).find((m) => sameMove(m, move));
  if (!matched) throw new MoveError('illegal-move');
  // Apply castling/en-passant flags from the matched generator move.
  const fullMove: Move = { ...matched };

  // No-promotion-target rule: if this move triggers promotion but the
  // diagonal opponent has no eligible piece to take, the move is illegal.
  if (fullMove.triggersPromotion && !diagonalHasEligiblePromotionTarget(gs, seat)) {
    throw new MoveError('no-promotion-target');
  }

  // Self-check legality.
  const result: ApplyMoveResult = applyMove(board, fullMove);
  if (!result.kingCaptured && inCheck(result.state, expectedColor)) {
    throw new MoveError('self-check');
  }

  gs.boards[boardId] = result.state;

  let capturedToPartnerHand: DropPieceType | null = null;
  if (result.captured) {
    const partner = partnerOf(seat);
    // Kings shouldn't be added to hand at all.
    if (result.captured.type !== 'K') {
      const handed = result.captured.type as DropPieceType;
      gs.hands[partner][handed] += 1;
      capturedToPartnerHand = handed;
    }
  }

  if (result.kingCaptured) {
    gs.status = 'ended';
    gs.result = {
      winningTeam: teamOf(seat),
      reason: 'king-capture',
      // The "loser" is the seat whose king was captured. That's the seat
      // that played the OTHER color on this board.
      losingSeat: seatOnBoard(boardId, expectedColor === 'w' ? 'b' : 'w'),
      boardId,
    };
  }

  return {
    triggeredPromotion: result.triggeredPromotion,
    kingCaptured: result.kingCaptured,
    capturedToPartnerHand,
  };
}

// ---------------- Drop ----------------

export type DropOutcome = { ok: true };

export function applyGameDrop(
  gs: GameState,
  seat: Seat,
  drop: DropAttempt,
): DropOutcome {
  const boardId = seatBoard(seat);
  const color = seatColor(seat);
  const board = gs.boards[boardId];
  const hand = gs.hands[seat];
  const available = hand[drop.piece];

  // applyDropRaw validates everything except mate-by-drop, and returns the
  // post-drop state with turn switched.
  const next = applyDropRaw(board, color, drop, available);

  // Mate-by-drop validation: if the opponent is now in check AND has no
  // legal escape (own moves + own drops from THEIR hand), the drop is illegal.
  const oppColor = color === 'w' ? 'b' : 'w';
  if (inCheck(next, oppColor)) {
    const oppSeat = seatOnBoard(boardId, oppColor);
    const oppHand = gs.hands[oppSeat];
    if (!hasAnyEscape(next, oppColor, oppHand)) {
      throw new DropError('mate-by-drop');
    }
  }

  gs.boards[boardId] = next;
  gs.hands[seat] = { ...hand, [drop.piece]: available - 1 };
  return { ok: true };
}

// Returns true if the side-to-move (color) has any move OR drop that gets
// out of check (i.e., any escape from the current check).
function hasAnyEscape(state: BoardState, color: Color, hand: Hand): boolean {
  if (state.turn !== color) return false;
  // Own moves.
  if (hasLegalMove(state)) return true;
  // Own drops from their hand. Try every empty square with every piece type
  // they have. For each candidate, the dropper would not be in self-check
  // (since the drop blocks the check) — verify by simulating.
  for (const pt of Object.keys(hand) as DropPieceType[]) {
    const count = hand[pt];
    if (count <= 0) continue;
    for (let s = 0; s < 64; s++) {
      if (state.board[s]) continue;
      if (pt === 'P') {
        const r = rankOf(s);
        if (r === 0 || r === 7) continue;
      }
      // Simulate drop.
      const test = state.board.slice();
      test[s] = { type: pt, color, wasPromoted: false };
      const k = findKingIn(test, color);
      if (k === null) continue;
      if (!isAttacked(test, k, color === 'w' ? 'b' : 'w')) {
        return true;
      }
    }
  }
  return false;
}

function findKingIn(board: (BoardState['board'][number])[], color: Color): Square | null {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'K' && p.color === color) return i;
  }
  return null;
}

function isAttacked(
  board: (BoardState['board'][number])[],
  target: Square,
  byColor: Color,
): boolean {
  const fakeState: BoardState = {
    board: board as BoardState['board'],
    turn: 'w',
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: null,
    pendingPromotion: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
  // Reuse the engine's check via isSquareAttacked by importing... but that
  // would be circular. Easiest: a tiny inline.
  return isSquareAttackedInline(fakeState.board, target, byColor);
}

// Inline copy of isSquareAttacked to avoid a circular import (game -> moves
// is fine, but we already import from moves above; keep this self-contained
// for the hand-aware escape test).
function isSquareAttackedInline(
  board: BoardState['board'],
  target: Square,
  byColor: Color,
): boolean {
  const tf = target & 7;
  const tr = target >> 3;
  const inB = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
  const at = (f: number, r: number) => board[r * 8 + f];

  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const f = tf - df;
    const r = tr - pawnDir;
    if (inB(f, r)) {
      const p = at(f, r);
      if (p && p.color === byColor && p.type === 'P') return true;
    }
  }
  const KN: Array<[number, number]> = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  for (const [df, dr] of KN) {
    const f = tf + df, r = tr + dr;
    if (!inB(f, r)) continue;
    const p = at(f, r);
    if (p && p.color === byColor && p.type === 'N') return true;
  }
  const KG: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [df, dr] of KG) {
    const f = tf + df, r = tr + dr;
    if (!inB(f, r)) continue;
    const p = at(f, r);
    if (p && p.color === byColor && p.type === 'K') return true;
  }
  const BD: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [df, dr] of BD) {
    let f = tf + df, r = tr + dr;
    while (inB(f, r)) {
      const p = at(f, r);
      if (p) {
        if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }
  const RD: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [df, dr] of RD) {
    let f = tf + df, r = tr + dr;
    while (inB(f, r)) {
      const p = at(f, r);
      if (p) {
        if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
        break;
      }
      f += df; r += dr;
    }
  }
  return false;
}

// ---------------- Promotion ----------------

export type PromotionOutcome = {
  takenType: Exclude<PieceType, 'K' | 'P'>;
};

export function applyGamePromotion(
  gs: GameState,
  seat: Seat,
  diagonalSquare: Square,
): PromotionOutcome {
  const boardId = seatBoard(seat);
  const color = seatColor(seat);
  const board = gs.boards[boardId];
  if (!board.pendingPromotion) throw new PromotionFlowError('no-pending');
  if (board.pendingPromotion.color !== color) throw new PromotionFlowError('wrong-color');

  // Diagonal seat -> diagonal board.
  const diagSeat = diagonalOf(seat);
  const diagBoardId = seatBoard(diagSeat);

  // Validate the target piece BEFORE mutating: must be the diagonal
  // opponent's piece (not your partner's), and not a king or pawn.
  const taken = gs.boards[diagBoardId].board[diagonalSquare];
  if (!taken) throw new PromotionFlowError('no-pending'); // empty square
  if (taken.color !== seatColor(diagSeat)) {
    throw new PromotionFlowError('wrong-target-color');
  }
  if (taken.type === 'K' || taken.type === 'P') {
    throw new PromotionFlowError('wrong-target-color');
  }

  const { state: diagAfter, takenType } = applyPromotionOnDiagonalBoard(
    gs.boards[diagBoardId],
    { diagonalSquare },
  );

  // Apply on the promoting board (place the piece on the promotion square,
  // switch turn).
  const promotedAfter = applyPromotionOnPromotingBoard(board, takenType);

  gs.boards[diagBoardId] = diagAfter;
  gs.boards[boardId] = promotedAfter;

  // Add a pawn to the diagonal opponent's hand.
  gs.hands[diagSeat].P += 1;

  return { takenType };
}

// Revert a pending promotion, restoring the pawn to its origin and un-doing
// any capture that was made to reach the last rank (also removes the captured
// piece from the partner's hand if it was credited there).
export function cancelGamePromotion(gs: GameState, seat: Seat): void {
  const boardId = seatBoard(seat);
  const color = seatColor(seat);
  const board = gs.boards[boardId];
  if (!board.pendingPromotion) throw new PromotionFlowError('no-pending');
  if (board.pendingPromotion.color !== color) throw new PromotionFlowError('wrong-color');

  const { capturedAtTo } = board.pendingPromotion;
  gs.boards[boardId] = cancelPromotion(board);

  // If the promotion-triggering move captured a piece, that piece was credited
  // to the partner's hand by applyGameMove — remove it now.
  if (capturedAtTo && capturedAtTo.type !== 'K') {
    const partner = partnerOf(seat);
    const handed = capturedAtTo.type as DropPieceType;
    gs.hands[partner][handed] = Math.max(0, gs.hands[partner][handed] - 1);
  }
}

// True if the given seat's pawn can legally promote at all (i.e., the
// diagonal opponent has at least one non-king, non-pawn piece). The engine
// uses this to filter pawn-moves to the last rank: if no eligible target
// exists on the diagonal board, the move is forbidden.
export function diagonalHasEligiblePromotionTarget(
  gs: GameState,
  seat: Seat,
): boolean {
  const diagSeat = diagonalOf(seat);
  const diagBoardId = seatBoard(diagSeat);
  const diagColor = seatColor(diagSeat);
  const b = gs.boards[diagBoardId].board;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p && p.color === diagColor && p.type !== 'K' && p.type !== 'P') return true;
  }
  return false;
}

// ---------------- Errors / helpers ----------------

export type MoveReason =
  | 'not-your-turn'
  | 'pending-promotion'
  | 'no-piece'
  | 'illegal-move'
  | 'self-check'
  | 'no-promotion-target';

export class MoveError extends Error {
  constructor(public reason: MoveReason) {
    super(reason);
  }
}

export type PromotionFlowReason =
  | 'no-pending'
  | 'wrong-color'
  | 'wrong-target-color';

export class PromotionFlowError extends Error {
  constructor(public reason: PromotionFlowReason) {
    super(reason);
  }
}

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to;
}

function seatOnBoard(boardId: BoardId, color: Color): Seat {
  if (boardId === 0) return color === 'w' ? 0 : 1;
  return color === 'w' ? 3 : 2;
}

export { seatOnBoard };
