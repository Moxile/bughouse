// The persisted shape of one finished game. Written once at finalize, read by
// the (future) history viewer. Kept in shared/ so server writers and client
// readers agree on the wire format.

import { GameEvent } from './events.js';
import { GameResult, Seat } from './types.js';

export type SavedGameRecord = {
  // Stable per-game UUID. Rooms reuse `code` across rematches, so this is the
  // primary identifier; never reuse.
  gameId: string;

  // All games played in the same room (across rematches and new-seating
  // resets) share a seriesId. seriesIndex is dense across saved games:
  // games dropped by `shouldPersist` don't consume a slot.
  seriesId: string;
  seriesIndex: number;

  // Room code at the time the game was played. Useful for display, NOT a key.
  code: string;

  startedAt: number; // ms since epoch — when status flipped to 'playing'
  endedAt: number;   // ms since epoch — when status flipped to 'ended'

  initialClockMs: number; // time-control initial value, per side, per board

  result: GameResult;

  // Snapshot of player display names at finalize. Kept here because
  // post-game roster changes (release-seat, new-seating with substitutes)
  // mustn't rewrite history.
  playerNames: Record<Seat, string>;

  // The full event journal. Replay this from a fresh GameState
  // (createGameState) to reconstruct the game at any seq.
  events: GameEvent[];
};
