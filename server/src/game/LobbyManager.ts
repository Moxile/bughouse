import { GameEvent, GameState, Seat, SEATS, teamOf } from '@bughouse/shared';
import { randomUUID } from 'node:crypto';
import { createGameState } from '../engine/game.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DISCONNECT_TIMEOUT_MS = 30_000;
const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type PlayerSlot = {
  seat: Seat;
  name: string;
  playerId: string; // uuid stored in client localStorage
  ready: boolean;
  connected: boolean;
  disconnectTimer?: ReturnType<typeof setTimeout>;
};

export type Room = {
  code: string;
  game: GameState;
  slots: Map<Seat, PlayerSlot>;
  // All WebSocket connections in this room (seat or spectator).
  clients: Set<RoomClient>;
  createdAt: number;
  // Append-only journal of state-changing actions for the CURRENT game.
  // Reset to [] on every fresh game (rematch, new-seating, room creation).
  // Server-only: never broadcast to clients.
  events: GameEvent[];

  // All games played in this room (across rematches and new-seating) share
  // a seriesId. seriesIndex is a *dense* counter over saved games — it only
  // increments when a game actually passes shouldPersist() and lands in the
  // database, so users see "Game 1, 2, 3" rather than gappy numbering.
  seriesId: string;
  seriesIndex: number;
};

export type RoomClient = {
  // null = spectator
  seat: Seat | null;
  playerId: string | null;
};

export class LobbyManager {
  private rooms = new Map<string, Room>();

  createRoom(now = Date.now()): Room {
    let code: string;
    do {
      code = Array.from({ length: 6 }, () =>
        CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!,
      ).join('');
    } while (this.rooms.has(code));

    const game = createGameState(code, now);
    const room: Room = {
      code,
      game,
      slots: new Map(),
      clients: new Set(),
      createdAt: now,
      events: [],
      seriesId: randomUUID(),
      seriesIndex: 0,
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    // Clear all disconnect timers.
    for (const slot of room.slots.values()) {
      if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
    }
    this.rooms.delete(code);
  }

  // Try to claim a seat. Returns the slot on success or null.
  claimSeat(
    room: Room,
    seat: Seat,
    name: string,
    playerId: string,
  ): PlayerSlot | null {
    if (room.game.status !== 'lobby') return null;
    if (room.slots.has(seat)) {
      // Allow re-claim if same playerId (reconnect).
      const existing = room.slots.get(seat)!;
      if (existing.playerId !== playerId) return null;
      return existing;
    }
    const slot: PlayerSlot = { seat, name, playerId, ready: false, connected: true };
    room.slots.set(seat, slot);
    return slot;
  }

  // Mark a player ready. Returns true if all 4 are now ready.
  setReady(room: Room, seat: Seat): boolean {
    const slot = room.slots.get(seat);
    if (!slot) return false;
    slot.ready = true;
    return (
      room.slots.size === 4 &&
      [...room.slots.values()].every((s) => s.ready)
    );
  }

  setUnready(room: Room, seat: Seat): void {
    const slot = room.slots.get(seat);
    if (slot) slot.ready = false;
  }

  handleDisconnect(
    room: Room,
    seat: Seat,
    onTimeout: (room: Room, seat: Seat) => void,
  ): void {
    const slot = room.slots.get(seat);
    if (!slot) return;
    slot.connected = false;
    slot.disconnectTimer = setTimeout(() => {
      onTimeout(room, seat);
    }, DISCONNECT_TIMEOUT_MS);
  }

  handleReconnect(room: Room, seat: Seat): void {
    const slot = room.slots.get(seat);
    if (!slot) return;
    slot.connected = true;
    if (slot.disconnectTimer) {
      clearTimeout(slot.disconnectTimer);
      slot.disconnectTimer = undefined;
    }
  }

  // Delete rooms that have no connected clients and haven't been active for ROOM_TTL_MS.
  // Returns the codes of deleted rooms so callers can clean up associated state.
  pruneIdleRooms(now = Date.now()): string[] {
    const deleted: string[] = [];
    for (const [code, room] of this.rooms) {
      const idle = room.clients.size === 0 && room.game.status !== 'playing';
      if (idle && now - room.createdAt > ROOM_TTL_MS) {
        this.deleteRoom(code);
        deleted.push(code);
      }
    }
    return deleted;
  }

  // Return all rooms (for cleanup/stats).
  allRooms(): Room[] {
    return [...this.rooms.values()];
  }
}
