import {
  Board,
  BoardState,
  Color,
  Piece,
  PieceType,
  Square,
  fileOf,
  otherColor,
  rankOf,
  sq,
} from '../types.js';
import { findKing } from './board.js';

export type Move = {
  from: Square;
  to: Square;
  // Set on en-passant captures: the square of the captured pawn (different from `to`).
  enPassantCapture?: Square;
  // Set on castling moves: where the rook moves from/to.
  castle?: 'K' | 'Q';
  // For pawn moves to the last rank: marks the move as triggering promotion.
  // Promotion target piece selection happens in a second phase via the
  // promotion-swap mechanic; this flag only signals "freeze the board now".
  triggersPromotion?: boolean;
};

const KNIGHT_OFFSETS: Array<[number, number]> = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const KING_OFFSETS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const BISHOP_DIRS: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function inBounds(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

// Generate all squares attacked by `color`'s pieces. Used for check detection
// and castling-through-check tests. Does NOT consider blocking by own king
// (pinning); we just care about geometric attacks.
export function isSquareAttacked(board: Board, target: Square, byColor: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);

  // Pawn attacks (a pawn of `byColor` attacks diagonally forward).
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const f = tf - df;
    const r = tr - pawnDir;
    if (inBounds(f, r)) {
      const p = board[sq(f, r)];
      if (p && p.color === byColor && p.type === 'P') return true;
    }
  }

  // Knight attacks.
  for (const [df, dr] of KNIGHT_OFFSETS) {
    const f = tf + df;
    const r = tr + dr;
    if (!inBounds(f, r)) continue;
    const p = board[sq(f, r)];
    if (p && p.color === byColor && p.type === 'N') return true;
  }

  // King attacks (one square any direction).
  for (const [df, dr] of KING_OFFSETS) {
    const f = tf + df;
    const r = tr + dr;
    if (!inBounds(f, r)) continue;
    const p = board[sq(f, r)];
    if (p && p.color === byColor && p.type === 'K') return true;
  }

  // Sliding: bishops/queens along diagonals.
  for (const [df, dr] of BISHOP_DIRS) {
    let f = tf + df;
    let r = tr + dr;
    while (inBounds(f, r)) {
      const p = board[sq(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  // Sliding: rooks/queens along ranks/files.
  for (const [df, dr] of ROOK_DIRS) {
    let f = tf + df;
    let r = tr + dr;
    while (inBounds(f, r)) {
      const p = board[sq(f, r)];
      if (p) {
        if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

export function inCheck(state: BoardState, color: Color): boolean {
  const k = findKing(state.board, color);
  if (k === null) return false; // no king => not "in check" (it's already worse)
  return isSquareAttacked(state.board, k, otherColor(color));
}

// Generate pseudo-legal moves for the side to move. Pseudo-legal means
// geometrically valid + respects piece-specific rules + can't capture own
// pieces, but does NOT filter for moves that leave own king in check. Callers
// must filter with `isSelfCheckAfter` for legality.
export function pseudoLegalMoves(state: BoardState): Move[] {
  const moves: Move[] = [];
  const c = state.turn;
  const opp = otherColor(c);
  const b = state.board;

  for (let from = 0; from < 64; from++) {
    const piece = b[from];
    if (!piece || piece.color !== c) continue;
    const f = fileOf(from);
    const r = rankOf(from);

    switch (piece.type) {
      case 'P': {
        const dir = c === 'w' ? 1 : -1;
        const startRank = c === 'w' ? 1 : 6;
        const lastRank = c === 'w' ? 7 : 0;

        // One forward.
        const r1 = r + dir;
        if (inBounds(f, r1) && !b[sq(f, r1)]) {
          const to = sq(f, r1);
          const m: Move = { from, to };
          if (r1 === lastRank) m.triggersPromotion = true;
          moves.push(m);
          // Two forward.
          const r2 = r + 2 * dir;
          if (r === startRank && !b[sq(f, r2)]) {
            moves.push({ from, to: sq(f, r2) });
          }
        }
        // Captures.
        for (const df of [-1, 1]) {
          const cf = f + df;
          const cr = r + dir;
          if (!inBounds(cf, cr)) continue;
          const target = b[sq(cf, cr)];
          if (target && target.color === opp) {
            const m: Move = { from, to: sq(cf, cr) };
            if (cr === lastRank) m.triggersPromotion = true;
            moves.push(m);
          } else if (state.enPassant !== null && sq(cf, cr) === state.enPassant) {
            // En passant: target square is empty, capture the pawn behind.
            moves.push({
              from,
              to: state.enPassant,
              enPassantCapture: sq(cf, cr - dir),
            });
          }
        }
        break;
      }
      case 'N': {
        for (const [df, dr] of KNIGHT_OFFSETS) {
          const tf = f + df;
          const tr = r + dr;
          if (!inBounds(tf, tr)) continue;
          const target = b[sq(tf, tr)];
          if (!target || target.color === opp) {
            moves.push({ from, to: sq(tf, tr) });
          }
        }
        break;
      }
      case 'B':
      case 'R':
      case 'Q': {
        const dirs =
          piece.type === 'B' ? BISHOP_DIRS :
          piece.type === 'R' ? ROOK_DIRS :
          [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const [df, dr] of dirs) {
          let tf = f + df;
          let tr = r + dr;
          while (inBounds(tf, tr)) {
            const target = b[sq(tf, tr)];
            if (!target) {
              moves.push({ from, to: sq(tf, tr) });
            } else {
              if (target.color === opp) moves.push({ from, to: sq(tf, tr) });
              break;
            }
            tf += df;
            tr += dr;
          }
        }
        break;
      }
      case 'K': {
        for (const [df, dr] of KING_OFFSETS) {
          const tf = f + df;
          const tr = r + dr;
          if (!inBounds(tf, tr)) continue;
          const target = b[sq(tf, tr)];
          if (!target || target.color === opp) {
            moves.push({ from, to: sq(tf, tr) });
          }
        }
        // Castling. Standard rules: king and rook never moved, squares
        // between empty, king not in check, king does not pass through or
        // land on attacked squares.
        const homeRank = c === 'w' ? 0 : 7;
        if (r === homeRank && f === 4) {
          const rights = state.castling;
          const canK = c === 'w' ? rights.wK : rights.bK;
          const canQ = c === 'w' ? rights.wQ : rights.bQ;
          // Kingside: f1/f8, g1/g8 empty; e, f, g not attacked.
          if (canK
            && !b[sq(5, homeRank)]
            && !b[sq(6, homeRank)]
            && !isSquareAttacked(b, sq(4, homeRank), opp)
            && !isSquareAttacked(b, sq(5, homeRank), opp)
            && !isSquareAttacked(b, sq(6, homeRank), opp)
          ) {
            moves.push({ from, to: sq(6, homeRank), castle: 'K' });
          }
          // Queenside: b1/b8, c1/c8, d1/d8 empty; e, d, c not attacked.
          if (canQ
            && !b[sq(1, homeRank)]
            && !b[sq(2, homeRank)]
            && !b[sq(3, homeRank)]
            && !isSquareAttacked(b, sq(4, homeRank), opp)
            && !isSquareAttacked(b, sq(3, homeRank), opp)
            && !isSquareAttacked(b, sq(2, homeRank), opp)
          ) {
            moves.push({ from, to: sq(2, homeRank), castle: 'Q' });
          }
        }
        break;
      }
    }
  }

  return moves;
}

// Returns true if applying `move` would leave `color`'s king in check.
// We reuse applyMove logic but only for the simulation; to avoid a circular
// import we inline a minimal applier here that mirrors moves.ts core effects.
function simulateMove(state: BoardState, move: Move): Board {
  const b = state.board.map((p) => (p ? { ...p } : null));
  const piece = b[move.from]!;
  // En passant capture removes the pawn behind the destination.
  if (move.enPassantCapture !== undefined) {
    b[move.enPassantCapture] = null;
  }
  b[move.to] = piece;
  b[move.from] = null;
  // Castling: also move the rook.
  if (move.castle === 'K') {
    const r = rankOf(move.to);
    b[sq(5, r)] = b[sq(7, r)] ?? null;
    b[sq(7, r)] = null;
  } else if (move.castle === 'Q') {
    const r = rankOf(move.to);
    b[sq(3, r)] = b[sq(0, r)] ?? null;
    b[sq(0, r)] = null;
  }
  return b;
}

export function leavesOwnKingInCheck(state: BoardState, move: Move): boolean {
  const piece = state.board[move.from];
  if (!piece) return true; // shouldn't happen for pseudo-legal moves
  const after = simulateMove(state, move);
  const k = findKing(after, piece.color);
  if (k === null) return false; // no king to check; treat as not-self-check
  return isSquareAttacked(after, k, otherColor(piece.color));
}

export function legalMoves(state: BoardState): Move[] {
  return pseudoLegalMoves(state).filter((m) => !leavesOwnKingInCheck(state, m));
}

export function hasLegalMove(state: BoardState): boolean {
  // Could be optimized; correctness first.
  for (const m of pseudoLegalMoves(state)) {
    if (!leavesOwnKingInCheck(state, m)) return true;
  }
  return false;
}

export function pieceTypeAt(b: Board, s: Square): PieceType | null {
  return b[s]?.type ?? null;
}
