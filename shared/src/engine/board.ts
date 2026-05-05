import {
  Board,
  BoardState,
  CastlingRights,
  Color,
  Piece,
  Square,
  fileOf,
  inBounds,
  rankOf,
  sq,
} from '../types.js';

export function emptyBoard(): Board {
  return Array.from({ length: 64 }, () => null);
}

export function pieceChar(p: Piece): string {
  const ch = p.type;
  return p.color === 'w' ? ch : ch.toLowerCase();
}

export function startingBoard(): Board {
  const b = emptyBoard();
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'] as const;
  for (let f = 0; f < 8; f++) {
    b[sq(f, 0)] = { type: back[f]!, color: 'w', wasPromoted: false };
    b[sq(f, 1)] = { type: 'P', color: 'w', wasPromoted: false };
    b[sq(f, 6)] = { type: 'P', color: 'b', wasPromoted: false };
    b[sq(f, 7)] = { type: back[f]!, color: 'b', wasPromoted: false };
  }
  return b;
}

export function startingBoardState(): BoardState {
  return {
    board: startingBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    pendingPromotion: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}

export function cloneBoard(b: Board): Board {
  return b.map((p) => (p ? { ...p } : null));
}

export function cloneBoardState(s: BoardState): BoardState {
  return {
    board: cloneBoard(s.board),
    turn: s.turn,
    castling: { ...s.castling },
    enPassant: s.enPassant,
    pendingPromotion: s.pendingPromotion ? { ...s.pendingPromotion } : null,
    halfmoveClock: s.halfmoveClock,
    fullmoveNumber: s.fullmoveNumber,
  };
}

export function findKing(board: Board, color: Color): Square | null {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.type === 'K' && p.color === color) return i;
  }
  return null;
}

// Render a board to ASCII for debugging.
export function renderBoard(b: Board): string {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    out += `${r + 1} `;
    for (let f = 0; f < 8; f++) {
      const p = b[sq(f, r)];
      out += p ? pieceChar(p) : '.';
      out += ' ';
    }
    out += '\n';
  }
  out += '  a b c d e f g h\n';
  return out;
}

export function inBoundsSq(file: number, rank: number): boolean {
  return inBounds(file, rank);
}

export function rfOf(s: Square): { file: number; rank: number } {
  return { file: fileOf(s), rank: rankOf(s) };
}

export type { CastlingRights };
