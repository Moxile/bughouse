// The persisted shape of one finished game. Written once at finalize, read by
// the (future) history viewer. Kept in shared/ so server writers and client
// readers agree on the wire format.

import { GameEvent } from './events.js';
import { GameResult, Seat, SimulTeams } from './types.js';
import { RatingChange } from './auth.js';

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

  // Which teams had a single simul player controlling both seats.
  simulTeams: SimulTeams;
};

// Row returned by GET /api/users/:username/games — metadata only, no events blob.
export type GameHistoryRow = {
  gameId: string;
  startedAt: number;      // ms epoch
  endedAt: number;        // ms epoch
  rated: boolean;
  result: GameResult;
  playerNames: Record<Seat, string>;
  seats: Record<Seat, { userId: string | null }>;
  selfSeat: Seat;
  selfDelta: number | null; // null when unrated
  simulTeams: SimulTeams;
};

// Full game detail returned by GET /api/games/:gameId.
export type GameDetail = SavedGameRecord & {
  rated: boolean;
  seats: Record<Seat, { userId: string | null }>;
  ratingChanges: Record<Seat, RatingChange> | null;
};
