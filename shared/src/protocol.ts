// WebSocket message types shared between server and client.
import { BoardId, DropPieceType, GameState, Seat, SimulTeams, Square } from './types.js';
import { GameEvent } from './events.js';
import { RatingChange } from './auth.js';

// ---------- Runtime validation ----------

export const VALID_SEATS: ReadonlySet<number> = new Set([0, 1, 2, 3]);
export function isValidSeat(x: unknown): x is Seat {
  return typeof x === 'number' && VALID_SEATS.has(x);
}

const VALID_DROP_PIECES: ReadonlySet<string> = new Set(['P', 'N', 'B', 'R', 'Q']);

function isSquare(x: unknown): x is Square {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 64;
}

function isBoardId(x: unknown): x is BoardId {
  return x === 0 || x === 1;
}

// C0 + DEL + C1 control characters.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/g;
// Zero-width spaces, bidi-override marks, BOM. These enable spoofed
// usernames / chat messages, so strip them before storing.
const FORMAT_MARKS = /[​-‏‪-‮⁦-⁩﻿]/g;

// Strip control chars and zero-width / bidi-override formatting marks,
// NFC-normalize, then truncate by code points (not UTF-16 code units).
function sanitizeText(s: string, maxCodePoints: number): string {
  const cleaned = s
    .replace(CONTROL_CHARS, '')
    .replace(FORMAT_MARKS, '')
    .normalize('NFC')
    .trim();
  return Array.from(cleaned).slice(0, maxCodePoints).join('');
}

// Validate and normalize an inbound client message. Returns the sanitized
// message on success, or null if the input is malformed. The server must
// treat null as an "invalid-message" error and never trust raw input.
export function validateClientMessage(raw: unknown): ClientMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case 'join': {
      if (typeof m.code !== 'string' || m.code.length === 0 || m.code.length > 16) return null;
      if (m.playerId !== undefined && (typeof m.playerId !== 'string' || m.playerId.length > 64)) return null;
      return { type: 'join', code: m.code, playerId: m.playerId as string | undefined };
    }
    case 'claim-seat': {
      if (!isValidSeat(m.seat)) return null;
      return { type: 'claim-seat', seat: m.seat };
    }
    case 'ready': return { type: 'ready' };
    case 'unready': return { type: 'unready' };
    case 'move': {
      if (!isBoardId(m.boardId)) return null;
      if (!isSquare(m.from) || !isSquare(m.to)) return null;
      return { type: 'move', boardId: m.boardId, from: m.from, to: m.to };
    }
    case 'drop': {
      if (!isBoardId(m.boardId)) return null;
      if (typeof m.piece !== 'string' || !VALID_DROP_PIECES.has(m.piece)) return null;
      if (!isSquare(m.to)) return null;
      return { type: 'drop', boardId: m.boardId, piece: m.piece as DropPieceType, to: m.to };
    }
    case 'claim-simul': {
      if (m.team !== 0 && m.team !== 1) return null;
      return { type: 'claim-simul', team: m.team as 0 | 1 };
    }
    case 'release-simul': {
      if (m.team !== 0 && m.team !== 1) return null;
      return { type: 'release-simul', team: m.team as 0 | 1 };
    }
    case 'promotion-select': {
      if (!isSquare(m.diagonalSquare)) return null;
      const boardId = isBoardId(m.boardId) ? m.boardId : undefined;
      return { type: 'promotion-select', diagonalSquare: m.diagonalSquare, boardId };
    }
    case 'cancel-promotion': {
      const boardId = isBoardId(m.boardId) ? m.boardId : undefined;
      return { type: 'cancel-promotion', boardId };
    }
    case 'resign': return { type: 'resign' };
    case 'chat': {
      if (typeof m.text !== 'string') return null;
      const text = sanitizeText(m.text, 200);
      if (!text) return null;
      return { type: 'chat', text };
    }
    case 'rematch': return { type: 'rematch' };
    case 'release-seat': return { type: 'release-seat' };
    case 'new-seating': return { type: 'new-seating' };
    case 'set-time-control': {
      if (typeof m.minutes !== 'number' || !Number.isFinite(m.minutes)) return null;
      const minutes = Math.round(m.minutes);
      if (minutes < 1 || minutes > 5) return null;
      return { type: 'set-time-control', minutes };
    }
    case 'set-private': {
      if (typeof m.isPrivate !== 'boolean') return null;
      return { type: 'set-private', isPrivate: m.isPrivate };
    }
    case 'set-rated': {
      if (typeof m.isRated !== 'boolean') return null;
      return { type: 'set-rated', isRated: m.isRated };
    }
    case 'kick-seat': {
      if (!isValidSeat(m.seat)) return null;
      return { type: 'kick-seat', seat: m.seat };
    }
    case 'set-rating-range': {
      if (m.min === null && m.max === null) return { type: 'set-rating-range', min: null, max: null };
      if (typeof m.min !== 'number' || typeof m.max !== 'number') return null;
      const min = Math.round(m.min);
      const max = Math.round(m.max);
      if (min < 400 || max > 3200 || min >= max) return null;
      return { type: 'set-rating-range', min, max };
    }
    default:
      return null;
  }
}

// ---------- Client → Server ----------

export type C_Join = {
  type: 'join';
  code: string;
  // Optional player ID stored in localStorage for reconnects.
  playerId?: string;
};

export type C_ClaimSeat = {
  type: 'claim-seat';
  seat: Seat;
};

// Release the sender's currently held seat back into the lobby pool. Only
// valid while the room is in 'lobby' status.
export type C_ReleaseSeat = {
  type: 'release-seat';
};

export type C_Ready = {
  type: 'ready';
};

export type C_Unready = {
  type: 'unready';
};

export type C_Move = {
  type: 'move';
  boardId: BoardId;
  from: Square;
  to: Square;
};

export type C_Drop = {
  type: 'drop';
  boardId: BoardId;
  piece: DropPieceType;
  to: Square;
};

export type C_PromotionSelect = {
  type: 'promotion-select';
  // Square on the DIAGONAL opponent's board to take the piece from.
  diagonalSquare: Square;
  // Which board has the pending promotion (optional, used by simul players).
  boardId?: BoardId;
};

export type C_CancelPromotion = {
  type: 'cancel-promotion';
  // Which board to cancel promotion on (optional, used by simul players).
  boardId?: BoardId;
};

export type C_ClaimSimul = {
  type: 'claim-simul';
  team: 0 | 1;
};

export type C_ReleaseSimul = {
  type: 'release-simul';
  team: 0 | 1;
};

export type C_Resign = {
  type: 'resign';
};

export type C_Chat = {
  type: 'chat';
  text: string;
};

export type C_Rematch = {
  type: 'rematch';
};

// Sent from the end-of-game screen to drop the room back to the seating
// lobby. Unilateral: any seated player triggers it for everyone (including
// spectators), so a substitute can take a seat for the next game.
export type C_NewSeating = {
  type: 'new-seating';
};

export type C_SetTimeControl = {
  type: 'set-time-control';
  // Minutes per player (1–5).
  minutes: number;
};

export type C_SetPrivate = {
  type: 'set-private';
  isPrivate: boolean;
};

export type C_SetRated = {
  type: 'set-rated';
  isRated: boolean;
};

export type C_KickSeat = {
  type: 'kick-seat';
  seat: Seat;
};

export type C_SetRatingRange = {
  type: 'set-rating-range';
  min: number | null;
  max: number | null;
};

export type ClientMessage =
  | C_Join
  | C_ClaimSeat
  | C_ReleaseSeat
  | C_ClaimSimul
  | C_ReleaseSimul
  | C_Ready
  | C_Unready
  | C_Move
  | C_Drop
  | C_PromotionSelect
  | C_CancelPromotion
  | C_Resign
  | C_Chat
  | C_Rematch
  | C_NewSeating
  | C_SetTimeControl
  | C_SetPrivate
  | C_SetRated
  | C_KickSeat
  | C_SetRatingRange;

// ---------- Server → Client ----------

export type SeatInfo = {
  name: string;
  rating: number | null;
  isGuest: boolean;
};

// Full game snapshot broadcast after every state change.
export type S_State = {
  type: 'state';
  game: GameState;
  // The player's own seat, or null if spectating.
  yourSeat: Seat | null;
  // Map of seat -> player info (name, rating, guest status). null = empty seat.
  names: Record<Seat, SeatInfo | null>;
  // Map of seat -> ready flag.
  ready: Record<Seat, boolean>;
  // Map of seat -> connected flag.
  connected: Record<Seat, boolean>;
  // Append-only journal of moves/drops in the CURRENT game. Empty in lobby
  // and after a fresh reset; grows as the game progresses. Drives the
  // notation panel and (later) replay.
  events: GameEvent[];
  // Whether the room is hidden from the public games list.
  isPrivate: boolean;
  // Whether the room is set to rated mode (only applies when all 4 are authenticated).
  isRated: boolean;
  // Rating changes from the just-finished game. Present only when all 4 players
  // were authenticated and isRated was true. Null otherwise (unrated game).
  ratingChanges: Record<Seat, RatingChange> | null;
  // Which seat the room owner is currently sitting at, or null if owner has no seat.
  ownerSeat: Seat | null;
  // Optional rating range restriction. Guests and out-of-range players cannot claim seats.
  ratingRange: { min: number; max: number } | null;
  // Simul mode fields. simulTeams tracks which teams have a single player on both seats.
  simulTeams: SimulTeams;
  // All seats held by the receiving client (0-2 entries). yourSeat = yourSeats[0] ?? null.
  yourSeats: Seat[];
  // Whether this room allows simul seat claims.
  allowSimul: boolean;
};

export type S_Error = {
  type: 'error';
  reason: string;
};

export type S_Chat = {
  type: 'chat';
  fromSeat: Seat;
  fromName: string;
  text: string;
};

// Your player ID, sent immediately on successful join so the client can
// persist it for reconnects.
export type S_Welcome = {
  type: 'welcome';
  playerId: string;
};

export type ServerMessage = S_State | S_Error | S_Chat | S_Welcome;
