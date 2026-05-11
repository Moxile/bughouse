// Append-only journal of state-changing actions in a game. Built up in memory
// during play; the plan is to persist it to a database when the game ends.
//
// Each event carries:
//   - seq: 1-based monotonic counter, unique within a single game
//   - ts:  wall-clock time in ms (Date.now()) — replayed clocks are derived
//          from these timestamps + the game's initialClockMs
//
// Promotions are recorded as a single atomic `move` event at the moment the
// player picks the promoted piece (not when the pawn first reaches the last
// rank). Cancelled promotions are not logged at all.
//
// Game-ending events that don't change board state (resign, flag, disconnect)
// are intentionally NOT in this log — the game's `result` blob carries the
// reason. The end timestamp is derivable as the last event's `ts` for moves
// that mate, or computed from clock math for time-outs.

import { BoardId, DropPieceType, Seat, Square } from './types.js';

export type GameEventMove = {
  kind: 'move';
  seq: number;
  ts: number;
  boardId: BoardId;
  seat: Seat;
  from: Square;
  to: Square;
  // Set only when this move included a promotion. `promotedTo` is the piece
  // type taken from the diagonal opponent; `promotedFromSquare` is where on
  // the diagonal board it was taken from (for replay reconstruction).
  promotedTo?: 'N' | 'B' | 'R' | 'Q';
  promotedFromSquare?: Square;
};

export type GameEventDrop = {
  kind: 'drop';
  seq: number;
  ts: number;
  boardId: BoardId;
  seat: Seat;
  piece: DropPieceType;
  to: Square;
};

export type GameEvent = GameEventMove | GameEventDrop;
