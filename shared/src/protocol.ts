// WebSocket message types shared between server and client.
import { BoardId, DropPieceType, GameState, Seat, Square } from './types.js';

// ---------- Client → Server ----------

export type C_Join = {
  type: 'join';
  code: string;
  // Optional player ID stored in localStorage for reconnects.
  playerId?: string;
  name: string;
};

export type C_ClaimSeat = {
  type: 'claim-seat';
  seat: Seat;
};

export type C_Ready = {
  type: 'ready';
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
};

export type C_CancelPromotion = {
  type: 'cancel-promotion';
};

export type C_Resign = {
  type: 'resign';
};

export type C_Chat = {
  type: 'chat';
  text: string;
};

export type ClientMessage =
  | C_Join
  | C_ClaimSeat
  | C_Ready
  | C_Move
  | C_Drop
  | C_PromotionSelect
  | C_CancelPromotion
  | C_Resign
  | C_Chat;

// ---------- Server → Client ----------

// Full game snapshot broadcast after every state change.
export type S_State = {
  type: 'state';
  game: GameState;
  // The player's own seat, or null if spectating.
  yourSeat: Seat | null;
  // Map of seat -> player name.
  names: Record<Seat, string | null>;
  // Map of seat -> ready flag.
  ready: Record<Seat, boolean>;
  // Map of seat -> connected flag.
  connected: Record<Seat, boolean>;
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
