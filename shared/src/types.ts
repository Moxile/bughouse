// Shared types between client and server.

export type Color = 'w' | 'b';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type DropPieceType = Exclude<PieceType, 'K'>;
export type BoardId = 0 | 1;
export type Seat = 0 | 1 | 2 | 3;

export type Piece = {
  type: PieceType;
  color: Color;
  // True if this piece occupies the board because it was placed there via the
  // promotion-swap rule. When captured, such a piece returns a pawn to the
  // capturing player's partner's hand instead of its actual type.
  wasPromoted: boolean;
};

export type Square = number; // 0..63, file = sq % 8, rank = sq / 8 (rank 0 is white's home rank)

export type Board = (Piece | null)[]; // length 64

export type Hand = Record<DropPieceType, number>;

export type CastlingRights = {
  wK: boolean; // white kingside
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
};

// Single-board state. The bughouse Game holds two of these.
export type BoardState = {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null; // square the pawn skipped over, or null
  // Pending promotion: the side-to-move just moved a pawn to its last rank;
  // the board is frozen for that color until a promotion-select arrives.
  // capturedAtTo is the piece that occupied `to` before the pawn moved (null
  // for a straight push), stored so the move can be cancelled/reverted.
  pendingPromotion: { from: Square; to: Square; color: Color; capturedAtTo: Piece | null } | null;
  halfmoveClock: number; // unused for win logic but tracked for completeness
  fullmoveNumber: number;
  // The origin and destination of the most recent move/drop on this board.
  // For drops, from === to (only the landing square is highlighted).
  lastMove: { from: Square; to: Square } | null;
};

// Bughouse seating:
//   Seat 0 = Board 0 White
//   Seat 1 = Board 0 Black
//   Seat 2 = Board 1 Black
//   Seat 3 = Board 1 White
// Teams: (Seat 0, Seat 2) vs (Seat 1, Seat 3)
// Partner of seat S = the seat with the same team.
// Diagonal of seat S = the same color on the other board.
//   Seat 0 (B0,W) diagonal = Seat 3 (B1,W)
//   Seat 1 (B0,B) diagonal = Seat 2 (B1,B)
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export function seatBoard(seat: Seat): BoardId {
  return seat < 2 ? 0 : 1;
}
export function seatColor(seat: Seat): Color {
  // 0=W, 1=B, 2=B, 3=W
  return seat === 0 || seat === 3 ? 'w' : 'b';
}
export function partnerOf(seat: Seat): Seat {
  // 0<->2, 1<->3
  return ((seat + 2) % 4) as Seat;
}
export function diagonalOf(seat: Seat): Seat {
  // same color on other board
  // 0(B0,W) <-> 3(B1,W); 1(B0,B) <-> 2(B1,B)
  switch (seat) {
    case 0: return 3;
    case 1: return 2;
    case 2: return 1;
    case 3: return 0;
  }
}

export type Hands = Record<Seat, Hand>;

export type GameStatus = 'lobby' | 'playing' | 'ended';

export type GameResultReason =
  | 'king-capture'
  | 'checkmate'
  | 'time'
  | 'resign'
  | 'disconnect';

export type GameResult = {
  winningTeam: 0 | 1; // team 0 = seats {0,2}; team 1 = seats {1,3}
  reason: GameResultReason;
  // Which seat triggered the end (the loser, or the resigner).
  losingSeat: Seat;
  // Which board the terminal event happened on, if applicable.
  boardId?: BoardId;
};

export type GameState = {
  code: string;
  status: GameStatus;
  boards: [BoardState, BoardState];
  hands: Hands;
  // milliseconds remaining per seat at lastClockUpdate; clocks tick only
  // when status === 'playing' and only for the seat-to-move on each board.
  clocks: Record<Seat, number>;
  // Per-board reference timestamp. Each board has an independent clock so
  // a move on board 0 must not disturb board 1's running countdown.
  lastClockUpdate: [number, number]; // [board0, board1]; 0 if not started
  result: GameResult | null;
  startedAt: number | null;
  initialClockMs: number;
  // Tracks which seated players have voted for a rematch (status === 'ended').
  rematchVotes: Record<Seat, boolean>;
};

// ---------------- Helpers ----------------

export function emptyHand(): Hand {
  return { P: 0, N: 0, B: 0, R: 0, Q: 0 };
}

export function fileOf(sq: Square): number { return sq & 7; }
export function rankOf(sq: Square): number { return sq >> 3; }
export function sq(file: number, rank: number): Square { return rank * 8 + file; }

export function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function otherColor(c: Color): Color { return c === 'w' ? 'b' : 'w'; }

// Team that contains the given seat. Team 0 = {0,2}, team 1 = {1,3}.
export function teamOf(seat: Seat): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

