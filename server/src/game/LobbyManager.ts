import { GameEvent, GameState, RatingChange, Seat, SimulTeams, bothSeatsOfTeam, isValidSeat, teamOf } from '@bughouse/shared';
import { randomUUID, randomInt } from 'node:crypto';
import { createGameState } from '../engine/game.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DISCONNECT_TIMEOUT_MS = 30_000;
const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type PlayerSlot = {
  seat: Seat;
  name: string;
  playerId: string; // uuid stored in client sessionStorage
  userId: string | null; // authenticated user id, null for guests
  rating: number | null; // snapshot at join time
  ready: boolean;
  connected: boolean;
  disconnectTimer?: ReturnType<typeof setTimeout>;
};

export type RatingRange = { min: number; max: number };

export type Room = {
  code: string;
  game: GameState;
  slots: Map<Seat, PlayerSlot>;
  // All WebSocket connections in this room (seat or spectator).
  clients: Set<RoomClient>;
  createdAt: number;
  // Append-only journal of state-changing actions for the CURRENT game.
  events: GameEvent[];

  seriesId: string;
  seriesIndex: number;
  isPrivate: boolean;
  isRated: boolean;
  ratingChanges: Record<Seat, RatingChange> | null;

  // Owner: the player who created the room (playerId). Can be null if owner left
  // and no other seated player was available to inherit. The next seat-claimer
  // becomes owner when this is null.
  ownerPlayerId: string | null;
  // Ordered list of playerIds in the order they first claimed a seat.
  // Used for ownership transfer.
  joinOrder: string[];
  // When set, guests and players outside this range cannot claim seats.
  ratingRange: RatingRange | null;

  // Simul mode fields.
  allowSimul: boolean;
  simulTeams: SimulTeams;
};

export type RoomClient = {
  // null = spectator
  seat: Seat | null;
  playerId: string | null;
};

export interface CreateRoomOptions {
  ownerPlayerId: string;
  minutes?: number;
  isPrivate?: boolean;
  isRated?: boolean;
  ratingRange?: RatingRange | null;
  allowSimul?: boolean;
}

export class LobbyManager {
  private rooms = new Map<string, Room>();

  createRoom(opts: CreateRoomOptions, now = Date.now()): Room {
    let code: string;
    do {
      code = Array.from({ length: 6 }, () =>
        CODE_CHARS[randomInt(CODE_CHARS.length)]!,
      ).join('');
    } while (this.rooms.has(code));

    const minutes = opts.minutes ?? 5;
    const clockMs = minutes * 60 * 1000;
    const game = createGameState(code, now, clockMs);
    const room: Room = {
      code,
      game,
      slots: new Map(),
      clients: new Set(),
      createdAt: now,
      events: [],
      seriesId: randomUUID(),
      seriesIndex: 0,
      isPrivate: opts.isPrivate ?? false,
      isRated: opts.isRated ?? true,
      ratingChanges: null,
      ownerPlayerId: opts.ownerPlayerId,
      joinOrder: [],
      ratingRange: opts.ratingRange ?? null,
      allowSimul: opts.allowSimul ?? false,
      simulTeams: { 0: false, 1: false },
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
    for (const slot of room.slots.values()) {
      if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
    }
    this.rooms.delete(code);
  }

  // Try to claim a seat. Returns the slot on success or a rejection reason string.
  claimSeat(
    room: Room,
    seat: Seat,
    name: string,
    playerId: string,
    userId: string | null,
    rating: number | null,
  ): PlayerSlot | 'seat-taken' | 'rating-range' | 'guest-restricted' {
    if (!isValidSeat(seat)) return 'seat-taken';
    if (room.game.status !== 'lobby') return 'seat-taken';

    if (room.slots.has(seat)) {
      const existing = room.slots.get(seat)!;
      const samePlayer = userId
        ? existing.userId === userId
        : existing.playerId === playerId;
      if (!samePlayer) return 'seat-taken';
      return existing;
    }

    // Rating range enforcement
    if (room.ratingRange) {
      if (userId === null) return 'guest-restricted'; // guests blocked when range set
      if (rating === null || rating < room.ratingRange.min || rating > room.ratingRange.max) {
        return 'rating-range';
      }
    }

    const slot: PlayerSlot = { seat, name, playerId, userId, rating, ready: false, connected: true };
    room.slots.set(seat, slot);

    // Track join order for ownership transfer
    if (!room.joinOrder.includes(playerId)) {
      room.joinOrder.push(playerId);
    }

    // If no owner (e.g. owner left and no one inherited), this player becomes owner
    if (!room.ownerPlayerId) {
      room.ownerPlayerId = playerId;
    }

    return slot;
  }

  kickSeat(room: Room, seat: Seat): Seat[] {
    if (!room.slots.has(seat)) return [];
    const slot = room.slots.get(seat)!;
    if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
    room.slots.delete(seat);
    const removed = [seat];

    // If the kicked player owns both seats of their team via simul, also remove the partner seat.
    const team = teamOf(seat);
    if (room.simulTeams[team]) {
      const [s0, s1] = bothSeatsOfTeam(team);
      const partner = s0 === seat ? s1 : s0;
      const partnerSlot = room.slots.get(partner);
      if (partnerSlot && partnerSlot.playerId === slot.playerId) {
        if (partnerSlot.disconnectTimer) clearTimeout(partnerSlot.disconnectTimer);
        room.slots.delete(partner);
        removed.push(partner);
      }
      room.simulTeams[team] = false;
    }

    return removed;
  }

  // Atomically claim both seats of a team for a simul player.
  claimSimul(
    room: Room,
    team: 0 | 1,
    name: string,
    playerId: string,
    userId: string | null,
    rating: number | null,
  ): PlayerSlot[] | 'team-occupied' | 'rating-range' | 'guest-restricted' | 'simul-not-allowed' | 'not-lobby' {
    if (!room.allowSimul) return 'simul-not-allowed';
    if (room.game.status !== 'lobby') return 'not-lobby';

    const [seat0, seat1] = bothSeatsOfTeam(team);

    // Check if either seat is taken by a DIFFERENT player.
    for (const seat of [seat0, seat1] as Seat[]) {
      if (room.slots.has(seat)) {
        const existing = room.slots.get(seat)!;
        const samePlayer = userId ? existing.userId === userId : existing.playerId === playerId;
        if (!samePlayer) return 'team-occupied';
      }
    }

    // Rating range enforcement.
    if (room.ratingRange) {
      if (userId === null) return 'guest-restricted';
      if (rating === null || rating < room.ratingRange.min || rating > room.ratingRange.max) {
        return 'rating-range';
      }
    }

    const slots: PlayerSlot[] = [];
    for (const seat of [seat0, seat1] as Seat[]) {
      if (!room.slots.has(seat)) {
        const slot: PlayerSlot = { seat, name, playerId, userId, rating, ready: false, connected: true };
        room.slots.set(seat, slot);
        slots.push(slot);
      } else {
        slots.push(room.slots.get(seat)!);
      }
    }

    room.simulTeams[team] = true;

    if (!room.joinOrder.includes(playerId)) {
      room.joinOrder.push(playerId);
    }
    if (!room.ownerPlayerId) {
      room.ownerPlayerId = playerId;
    }

    return slots;
  }

  // Release both seats of a simul team. Only succeeds if both seats belong to playerId.
  releaseSimul(room: Room, team: 0 | 1, playerId: string): boolean {
    if (room.game.status !== 'lobby') return false;
    const [seat0, seat1] = bothSeatsOfTeam(team);
    const slot0 = room.slots.get(seat0);
    const slot1 = room.slots.get(seat1);
    if (!slot0 || !slot1) return false;
    if (slot0.playerId !== playerId || slot1.playerId !== playerId) return false;

    if (slot0.disconnectTimer) clearTimeout(slot0.disconnectTimer);
    if (slot1.disconnectTimer) clearTimeout(slot1.disconnectTimer);
    room.slots.delete(seat0);
    room.slots.delete(seat1);
    room.simulTeams[team] = false;
    return true;
  }

  // Set ready=true on all slots owned by playerId. Returns true if all 4 seats are now ready.
  setReadyByPlayer(room: Room, playerId: string): boolean {
    for (const slot of room.slots.values()) {
      if (slot.playerId === playerId) slot.ready = true;
    }
    return (
      room.slots.size === 4 &&
      [...room.slots.values()].every((s) => s.ready)
    );
  }

  // Set unready on all slots owned by playerId.
  setUnreadyByPlayer(room: Room, playerId: string): void {
    for (const slot of room.slots.values()) {
      if (slot.playerId === playerId) slot.ready = false;
    }
  }

  // Transfer ownership to the next player in joinOrder who is still seated.
  // Sets ownerPlayerId to null if no candidate found.
  transferOwnership(room: Room): void {
    for (const pid of room.joinOrder) {
      if (pid === room.ownerPlayerId) continue;
      const seated = [...room.slots.values()].find((s) => s.playerId === pid);
      if (seated) {
        room.ownerPlayerId = pid;
        return;
      }
    }
    room.ownerPlayerId = null;
  }

  getOwnerSeat(room: Room): Seat | null {
    if (!room.ownerPlayerId) return null;
    const slot = [...room.slots.values()].find((s) => s.playerId === room.ownerPlayerId);
    return slot?.seat ?? null;
  }

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
    if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
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

  allRooms(): Room[] {
    return [...this.rooms.values()];
  }

  roomCount(): number {
    return this.rooms.size;
  }
}
