import { WebSocket } from 'ws';
import {
  ClientMessage,
  GameEvent,
  GameEventDrop,
  GameEventMove,
  S_Chat,
  S_State,
  SeatInfo,
  SavedGameRecord,
  Seat,
  SEATS,
  ServerMessage,
  createGameState,
  partnerOf,
  seatBoard,
  teamOf,
  validateClientMessage,
} from '@bughouse/shared';
import { Persistence } from '../storage/Persistence.js';
import { LobbyManager, Room, CreateRoomOptions, RatingRange } from '../game/LobbyManager.js';
import { ClockManager } from '../game/ClockManager.js';
import { TokenBucket } from './RateLimiter.js';
import {
  DropError,
  applyDropRaw,
} from '../engine/apply.js';
import {
  MoveError,
  PromotionFlowError,
  applyGameDrop,
  applyGameMove,
  applyGamePromotion,
  cancelGamePromotion,
} from '../engine/game.js';
import { randomUUID } from 'node:crypto';

type ClientState = {
  ws: WebSocket;
  playerId: string | null;
  userId: string | null;
  displayName: string | null;
  rating: number | null;
  // All seats held by this client. Empty = spectator. Simul players hold 2 seats.
  seats: Seat[];
  room: Room | null;
  name: string | null;
  bucket: TokenBucket;
};

// Returns the seat this client owns on the given board, or null.
function ownedBoard(cs: ClientState, boardId: 0 | 1): Seat | null {
  return cs.seats.find((s) => seatBoard(s) === boardId) ?? null;
}

// Primary seat (first in list), for backwards-compat with single-seat code paths.
function primarySeat(cs: ClientState): Seat | null {
  return cs.seats[0] ?? null;
}

const INBOUND_BURST = 30;
const INBOUND_PER_SEC = 10;

const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ROOMS = 5000;

export type RoomSummary = {
  code: string;
  status: 'lobby' | 'playing';
  players: (string | null)[];
  seatsFilled: number;
  ownerName: string | null;
  isRated: boolean;
  minutes: number;
  ratingRange: RatingRange | null;
  allowSimul: boolean;
};

export class ConnectionManager {
  private lobby = new LobbyManager();
  private clients = new Map<WebSocket, ClientState>();
  private clocks = new Map<string, ClockManager>();

  constructor(private readonly store: Persistence | null = null) {
    setInterval(() => this.pruneRooms(), PRUNE_INTERVAL_MS);
  }

  private pruneRooms(): void {
    const deleted = this.lobby.pruneIdleRooms();
    for (const code of deleted) {
      this.clocks.get(code)?.stopAll();
      this.clocks.delete(code);
    }
  }

  handleConnection(
    ws: WebSocket,
    userId: string | null = null,
    displayName: string | null = null,
    rating: number | null = null,
  ): void {
    const cs: ClientState = {
      ws,
      playerId: null,
      userId,
      displayName,
      rating,
      seats: [],
      room: null,
      name: null,
      bucket: new TokenBucket(INBOUND_BURST, INBOUND_PER_SEC),
    };
    this.clients.set(ws, cs);

    ws.on('message', (raw) => {
      if (!cs.bucket.take('self')) {
        this.send(ws, { type: 'error', reason: 'rate-limited' });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        this.send(ws, { type: 'error', reason: 'invalid-message' });
        return;
      }
      const msg = validateClientMessage(parsed);
      if (!msg) {
        this.send(ws, { type: 'error', reason: 'invalid-message' });
        return;
      }
      this.handleMessage(cs, msg);
    });

    ws.on('close', () => {
      this.handleDisconnect(cs);
      this.clients.delete(ws);
    });
  }

  // Returns { code, ownerPlayerId } on success, null if server is full.
  createRoom(opts: Omit<CreateRoomOptions, 'ownerPlayerId'> & { ownerPlayerId?: string }): { code: string; ownerPlayerId: string } | null {
    if (this.lobby.roomCount() >= MAX_ROOMS) return null;
    const ownerPlayerId = opts.ownerPlayerId ?? randomUUID();
    const room = this.lobby.createRoom({ ...opts, ownerPlayerId });
    return { code: room.code, ownerPlayerId };
  }

  listRooms(): RoomSummary[] {
    return this.lobby.allRooms()
      .filter((r) => r.game.status !== 'ended' && !r.isPrivate)
      .map((r) => {
        const ownerSlot = r.ownerPlayerId
          ? [...r.slots.values()].find((s) => s.playerId === r.ownerPlayerId)
          : null;
        return {
          code: r.code,
          status: r.game.status as 'lobby' | 'playing',
          players: ([0, 1, 2, 3] as Seat[]).map((s) => r.slots.get(s)?.name ?? null),
          seatsFilled: r.slots.size,
          ownerName: ownerSlot?.name ?? null,
          isRated: r.isRated,
          minutes: Math.round(r.game.initialClockMs / 60000),
          ratingRange: r.ratingRange,
          allowSimul: r.allowSimul,
        };
      });
  }

  private isOwner(cs: ClientState): boolean {
    return !!cs.room?.ownerPlayerId && cs.room.ownerPlayerId === cs.playerId;
  }

  private handleMessage(cs: ClientState, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join': return this.handleJoin(cs, msg);
      case 'claim-seat': return this.handleClaimSeat(cs, msg);
      case 'release-seat': return this.handleReleaseSeat(cs);
      case ('claim-simul' as any): return this.handleClaimSimul(cs, msg as any);
      case ('release-simul' as any): return this.handleReleaseSimul(cs, msg as any);
      case 'ready': return this.handleReady(cs);
      case 'unready': return this.handleUnready(cs);
      case 'move': return this.handleMove(cs, msg);
      case 'drop': return this.handleDrop(cs, msg);
      case 'promotion-select': return this.handlePromotionSelect(cs, msg);
      case 'cancel-promotion': return this.handlePromotionCancel(cs, msg as any);
      case 'resign': return this.handleResign(cs);
      case 'chat': return this.handleChat(cs, msg);
      case 'rematch': return this.handleRematch(cs);
      case 'new-seating': return this.handleNewSeating(cs);
      case 'set-time-control': return this.handleSetTimeControl(cs, msg);
      case 'set-private': return this.handleSetPrivate(cs, msg);
      case 'set-rated': return this.handleSetRated(cs, msg);
      case 'kick-seat': return this.handleKickSeat(cs, msg);
      case 'set-rating-range': return this.handleSetRatingRange(cs, msg);
    }
  }

  private handleJoin(cs: ClientState, msg: { code: string; playerId?: string }): void {
    const room = this.lobby.getRoom(msg.code.toUpperCase());
    if (!room) {
      this.send(cs.ws, { type: 'error', reason: 'room-not-found' });
      return;
    }

    const playerId = msg.playerId ?? randomUUID();
    cs.playerId = playerId;
    cs.name = cs.displayName ?? 'Anonymous';
    cs.room = room;
    room.clients.add({ seat: primarySeat(cs), playerId });

    // Reconnect: find ALL slots owned by this player (may be 2 in simul mode).
    const reconnectSlots = cs.userId
      ? [...room.slots.values()].filter((s) => s.userId === cs.userId)
      : msg.playerId
      ? [...room.slots.values()].filter((s) => s.playerId === msg.playerId)
      : [];

    if (reconnectSlots.length > 0) {
      cs.seats = reconnectSlots.map((s) => s.seat);
      for (const slot of reconnectSlots) {
        this.lobby.handleReconnect(room, slot.seat);
      }
    }

    this.send(cs.ws, { type: 'welcome', playerId });
    this.broadcastState(room);
  }

  private handleClaimSeat(cs: ClientState, msg: { seat: Seat }): void {
    if (!cs.room || !cs.playerId || !cs.name) {
      this.send(cs.ws, { type: 'error', reason: 'not-joined' });
      return;
    }
    if (cs.room.game.status !== 'lobby') {
      this.send(cs.ws, { type: 'error', reason: 'game-in-progress' });
      return;
    }

    const result = this.lobby.claimSeat(
      cs.room, msg.seat, cs.name, cs.playerId, cs.userId, cs.rating,
    );

    if (result === 'seat-taken') {
      this.send(cs.ws, { type: 'error', reason: 'seat-taken' });
      return;
    }
    if (result === 'guest-restricted') {
      this.send(cs.ws, { type: 'error', reason: 'rating-range-set' });
      return;
    }
    if (result === 'rating-range') {
      this.send(cs.ws, { type: 'error', reason: 'outside-rating-range' });
      return;
    }

    cs.seats = [msg.seat];

    // Auto-disable rated if a guest just claimed a seat.
    if (cs.userId === null && cs.room.isRated) {
      cs.room.isRated = false;
    }

    this.broadcastState(cs.room);
  }

  private handleReleaseSeat(cs: ClientState): void {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (cs.room.game.status !== 'lobby') {
      this.send(cs.ws, { type: 'error', reason: 'game-in-progress' });
      return;
    }
    const wasOwner = this.isOwner(cs);
    for (const seat of cs.seats) cs.room.slots.delete(seat);
    // Clear simul flag for the team if the player was simul.
    for (const t of [0, 1] as (0 | 1)[]) {
      if (cs.room.simulTeams[t]) {
        const [s0, s1] = [t === 0 ? 0 : 1, t === 0 ? 2 : 3] as [Seat, Seat];
        if (!cs.room.slots.has(s0) && !cs.room.slots.has(s1)) {
          cs.room.simulTeams[t] = false;
        }
      }
    }
    cs.seats = [];
    if (wasOwner) this.lobby.transferOwnership(cs.room);
    this.broadcastState(cs.room);
  }

  private handleClaimSimul(cs: ClientState, msg: { team: 0 | 1 }): void {
    if (!cs.room || !cs.playerId || !cs.name) {
      this.send(cs.ws, { type: 'error', reason: 'not-joined' });
      return;
    }

    const result = this.lobby.claimSimul(
      cs.room, msg.team, cs.name, cs.playerId, cs.userId, cs.rating,
    );

    if (result === 'simul-not-allowed') {
      this.send(cs.ws, { type: 'error', reason: 'simul-not-allowed' });
      return;
    }
    if (result === 'not-lobby') {
      this.send(cs.ws, { type: 'error', reason: 'game-in-progress' });
      return;
    }
    if (result === 'team-occupied') {
      this.send(cs.ws, { type: 'error', reason: 'seat-taken' });
      return;
    }
    if (result === 'guest-restricted') {
      this.send(cs.ws, { type: 'error', reason: 'rating-range-set' });
      return;
    }
    if (result === 'rating-range') {
      this.send(cs.ws, { type: 'error', reason: 'outside-rating-range' });
      return;
    }

    cs.seats = result.map((s) => s.seat);

    // Auto-disable rated if guest, or if it creates a mixed simul.
    if (cs.userId === null && cs.room.isRated) {
      cs.room.isRated = false;
    } else if (cs.room.isRated && cs.room.simulTeams[0] !== cs.room.simulTeams[1]) {
      cs.room.isRated = false;
    }

    this.broadcastState(cs.room);
  }

  private handleReleaseSimul(cs: ClientState, msg: { team: 0 | 1 }): void {
    if (!cs.room || !cs.playerId) {
      this.send(cs.ws, { type: 'error', reason: 'not-joined' });
      return;
    }

    const released = this.lobby.releaseSimul(cs.room, msg.team, cs.playerId);
    if (!released) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }

    const wasOwner = this.isOwner(cs);
    const teamSeats: Seat[] = msg.team === 0 ? [0, 2] : [1, 3];
    cs.seats = cs.seats.filter((s) => !teamSeats.includes(s));
    if (wasOwner) this.lobby.transferOwnership(cs.room);
    this.broadcastState(cs.room);
  }

  private handleKickSeat(cs: ClientState, msg: { seat: Seat }): void {
    if (!cs.room) return;
    if (!this.isOwner(cs)) {
      this.send(cs.ws, { type: 'error', reason: 'not-owner' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    if (cs.seats.includes(msg.seat)) return; // can't kick yourself

    const removedSeats = this.lobby.kickSeat(cs.room, msg.seat);
    // Clear the kicked player's seat state on all their connections.
    for (const [, other] of this.clients) {
      if (other.room?.code === cs.room.code && other.seats.some((s) => removedSeats.includes(s))) {
        other.seats = other.seats.filter((s) => !removedSeats.includes(s));
      }
    }
    this.broadcastState(cs.room);
  }

  private handleReady(cs: ClientState): void {
    if (!cs.room || cs.seats.length === 0 || !cs.playerId) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    const allReady = this.lobby.setReadyByPlayer(cs.room, cs.playerId);
    if (allReady) {
      this.startGame(cs.room);
    } else {
      this.broadcastState(cs.room);
    }
  }

  private handleUnready(cs: ClientState): void {
    if (!cs.room || cs.seats.length === 0 || !cs.playerId) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    this.lobby.setUnreadyByPlayer(cs.room, cs.playerId);
    this.broadcastState(cs.room);
  }

  private handleSetPrivate(cs: ClientState, msg: { isPrivate: boolean }): void {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (!this.isOwner(cs)) {
      this.send(cs.ws, { type: 'error', reason: 'not-owner' });
      return;
    }
    cs.room.isPrivate = msg.isPrivate;
    this.broadcastState(cs.room);
  }

  private handleSetRated(cs: ClientState, msg: { isRated: boolean }): void {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (!this.isOwner(cs)) {
      this.send(cs.ws, { type: 'error', reason: 'not-owner' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    if (msg.isRated && cs.userId === null) return;
    if (msg.isRated) {
      const anyGuest = [...cs.room.slots.values()].some((s) => s.userId === null);
      if (anyGuest) return;
      // Cannot enable rated in a mixed simul+normal room.
      if (cs.room.simulTeams[0] !== cs.room.simulTeams[1]) return;
    }
    cs.room.isRated = msg.isRated;
    this.broadcastState(cs.room);
  }

  private handleSetRatingRange(cs: ClientState, msg: { min: number | null; max: number | null }): void {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (!this.isOwner(cs)) {
      this.send(cs.ws, { type: 'error', reason: 'not-owner' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    cs.room.ratingRange = (msg.min !== null && msg.max !== null)
      ? { min: msg.min, max: msg.max }
      : null;
    this.broadcastState(cs.room);
  }

  private handleSetTimeControl(cs: ClientState, msg: { minutes: number }): void {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (!this.isOwner(cs)) {
      this.send(cs.ws, { type: 'error', reason: 'not-owner' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    const minutes = Math.round(msg.minutes);
    if (minutes < 1 || minutes > 5) return;
    const ms = minutes * 60 * 1000;
    const game = cs.room.game;
    game.initialClockMs = ms;
    game.clocks[0] = ms;
    game.clocks[1] = ms;
    game.clocks[2] = ms;
    game.clocks[3] = ms;
    this.broadcastState(cs.room);
  }

  private startGame(room: Room): void {
    const now = Date.now();
    room.game.status = 'playing';
    const cm = new ClockManager();
    this.clocks.set(room.code, cm);
    cm.start(room.game, now, (seat) => this.handleFlag(room, seat));
    this.broadcastState(room);
  }

  private appendEvent(room: Room, ev: Omit<GameEventMove, 'seq'>): void;
  private appendEvent(room: Room, ev: Omit<GameEventDrop, 'seq'>): void;
  private appendEvent(room: Room, ev: Omit<GameEvent, 'seq'>): void {
    room.events.push({ ...ev, seq: room.events.length + 1 } as GameEvent);
  }

  private finalizeGame(room: Room, endedAt: number): void {
    if (!this.store) return;
    if (!shouldPersist(room)) return;
    if (!room.game.startedAt || !room.game.result) return;

    const nextIndex = room.seriesIndex + 1;
    const record = {
      gameId: randomUUID(),
      seriesId: room.seriesId,
      seriesIndex: nextIndex,
      code: room.code,
      startedAt: room.game.startedAt,
      endedAt,
      initialClockMs: room.game.initialClockMs,
      result: room.game.result,
      playerNames: snapshotPlayerNames(room),
      events: [...room.events],
      simulTeams: { ...room.simulTeams },
    } as SavedGameRecord;

    const seatUserIds: Record<Seat, string | null> = {
      0: room.slots.get(0)?.userId ?? null,
      1: room.slots.get(1)?.userId ?? null,
      2: room.slots.get(2)?.userId ?? null,
      3: room.slots.get(3)?.userId ?? null,
    };

    this.store.saveGame(record, seatUserIds, room.isRated)
      .then((changes) => {
        room.seriesIndex = nextIndex;
        if (changes) room.ratingChanges = changes;
        console.log(
          `[store] saved game ${record.gameId} (room ${room.code}, ` +
          `series ${room.seriesId.slice(0, 8)} #${nextIndex}, ${record.events.length} events)`,
        );
      })
      .catch((e) => {
        console.error(`[store] failed to save game for room ${room.code}:`, e);
      });
  }

  private handleMove(cs: ClientState, msg: { boardId: number; from: number; to: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const boardId = msg.boardId as 0 | 1;
    const seat = ownedBoard(cs, boardId);
    if (seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    const now = Date.now();
    try {
      const out = applyGameMove(room.game, seat, { from: msg.from, to: msg.to });
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
      if (!out.triggeredPromotion) {
        this.appendEvent(room, {
          kind: 'move',
          ts: now,
          boardId: seatBoard(seat),
          seat,
          from: msg.from,
          to: msg.to,
        });
      }
      if (room.game.status === 'ended') {
        cm.stopAll();
        this.recordScore(room);
        this.finalizeGame(room, now);
      }
      this.broadcastState(room);
    } catch (e) {
      const reason = e instanceof MoveError ? e.reason : 'illegal-move';
      this.send(cs.ws, { type: 'error', reason });
    }
  }

  private handleDrop(cs: ClientState, msg: { boardId: number; piece: string; to: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const boardId = msg.boardId as 0 | 1;
    const seat = ownedBoard(cs, boardId);
    if (seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    const now = Date.now();
    try {
      applyGameDrop(room.game, seat, { piece: msg.piece as any, to: msg.to });
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
      this.appendEvent(room, {
        kind: 'drop',
        ts: now,
        boardId: seatBoard(seat),
        seat,
        piece: msg.piece as any,
        to: msg.to,
      });
      this.broadcastState(room);
    } catch (e) {
      const reason = e instanceof DropError ? e.reason : 'illegal-drop';
      this.send(cs.ws, { type: 'error', reason });
    }
  }

  private handlePromotionSelect(cs: ClientState, msg: { diagonalSquare: number; boardId?: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    // Find which board has a pending promotion owned by this player.
    let seat = primarySeat(cs)!;
    if (msg.boardId !== undefined) {
      const s = ownedBoard(cs, msg.boardId as 0 | 1);
      if (s !== null) seat = s;
    } else {
      // Auto-detect: find which of our boards has a pending promotion.
      for (const s of cs.seats) {
        if (room.game.boards[seatBoard(s)].pendingPromotion) {
          seat = s;
          break;
        }
      }
    }
    const now = Date.now();
    const boardId = seatBoard(seat);
    const pending = room.game.boards[boardId].pendingPromotion;
    try {
      const out = applyGamePromotion(room.game, seat, msg.diagonalSquare);
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
      if (pending) {
        this.appendEvent(room, {
          kind: 'move',
          ts: now,
          boardId,
          seat,
          from: pending.from,
          to: pending.to,
          promotedTo: out.takenType,
          promotedFromSquare: msg.diagonalSquare,
        });
      }
      if (room.game.status === 'ended') {
        cm.stopAll();
        this.recordScore(room);
        this.finalizeGame(room, now);
      }
      this.broadcastState(room);
    } catch (e) {
      const reason = e instanceof PromotionFlowError ? e.reason : 'illegal-promotion';
      this.send(cs.ws, { type: 'error', reason });
    }
  }

  private handlePromotionCancel(cs: ClientState, msg?: { boardId?: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    let seat = primarySeat(cs)!;
    if (msg?.boardId !== undefined) {
      const s = ownedBoard(cs, msg.boardId as 0 | 1);
      if (s !== null) seat = s;
    } else {
      for (const s of cs.seats) {
        if (room.game.boards[seatBoard(s)].pendingPromotion) {
          seat = s;
          break;
        }
      }
    }
    try {
      cancelGamePromotion(room.game, seat);
      this.broadcastState(room);
    } catch (e) {
      const reason = e instanceof PromotionFlowError ? e.reason : 'illegal-promotion';
      this.send(cs.ws, { type: 'error', reason });
    }
  }

  private handleResign(cs: ClientState): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const seat = primarySeat(cs)!;
    const now = Date.now();
    room.game.status = 'ended';
    room.game.result = {
      winningTeam: (teamOf(seat) === 0 ? 1 : 0) as 0 | 1,
      reason: 'resign',
      losingSeat: seat,
    };
    this.clocks.get(room.code)?.stopAll();
    this.recordScore(room);
    this.finalizeGame(room, now);
    this.broadcastState(room);
  }

  private handleRematch(cs: ClientState): void {
    if (!cs.room || cs.seats.length === 0) return;
    const room = cs.room;
    if (room.game.status !== 'ended') return;

    for (const seat of cs.seats) {
      room.game.rematchVotes[seat] = true;
    }

    const allVoted =
      room.slots.size === 4 &&
      SEATS.every((s) => room.game.rematchVotes[s]);

    if (allVoted) {
      this.startRematch(room);
    } else {
      this.broadcastState(room);
    }
  }

  private handleNewSeating(cs: ClientState): void {
    if (!cs.room || cs.seats.length === 0) return;
    const room = cs.room;
    if (room.game.status !== 'ended') return;

    this.clocks.get(room.code)?.stopAll();
    this.clocks.delete(room.code);

    const prevClockMs = room.game.initialClockMs;
    room.game = createGameState(room.code, Date.now(), prevClockMs);
    room.events = [];
    room.ratingChanges = null;

    for (const slot of room.slots.values()) {
      slot.ready = false;
    }

    this.broadcastState(room);
  }

  private startRematch(room: Room): void {
    const now = Date.now();

    const swapMap: Record<Seat, Seat> = { 0: 1, 1: 0, 2: 3, 3: 2 };
    const newSlots = new Map<Seat, import('../game/LobbyManager.js').PlayerSlot>();
    for (const [seat, slot] of room.slots) {
      const newSeat = swapMap[seat];
      newSlots.set(newSeat, { ...slot, seat: newSeat, ready: false });
    }
    room.slots = newSlots;

    // Swap simulTeams (team 0's players become team 1 and vice versa).
    const prevSimul0 = room.simulTeams[0];
    room.simulTeams[0] = room.simulTeams[1];
    room.simulTeams[1] = prevSimul0;

    for (const [, cs] of this.clients) {
      if (cs.room?.code === room.code && cs.seats.length > 0) {
        cs.seats = cs.seats.map((s) => swapMap[s]);
      }
    }

    const prevScore: [number, number] = [room.game.seriesScore[1], room.game.seriesScore[0]];
    const prevClockMs = room.game.initialClockMs;

    room.game = createGameState(room.code, now, prevClockMs);
    room.game.seriesScore = prevScore;
    room.game.status = 'playing';
    room.game.startedAt = now;
    room.game.lastClockUpdate = [now, now];
    room.events = [];
    room.ratingChanges = null;

    this.clocks.get(room.code)?.stopAll();
    const cm = new ClockManager();
    this.clocks.set(room.code, cm);
    cm.start(room.game, now, (seat) => this.handleFlag(room, seat));

    this.broadcastState(room);
  }

  private handleChat(cs: ClientState, msg: { text: string }): void {
    if (!cs.room || cs.seats.length === 0) return;
    const text = msg.text.trim().slice(0, 200);
    if (!text) return;
    const seat = primarySeat(cs)!;
    const slot = cs.room.slots.get(seat);
    if (!slot) return;
    const partner = partnerOf(seat);
    // In simul mode the partner seat belongs to the same player — no one to chat with.
    const partnerSlot = cs.room.slots.get(partner);
    if (partnerSlot && partnerSlot.playerId === cs.playerId) return;
    const chatMsg: S_Chat = {
      type: 'chat',
      fromSeat: seat,
      fromName: slot.name,
      text,
    };
    this.sendToSeats(cs.room, [seat, partner], chatMsg);
  }

  private handleFlag(room: Room, seat: Seat): void {
    if (room.game.status !== 'playing') return;
    const now = Date.now();
    room.game.status = 'ended';
    room.game.result = {
      winningTeam: (teamOf(seat) === 0 ? 1 : 0) as 0 | 1,
      reason: 'time',
      losingSeat: seat,
    };
    this.clocks.get(room.code)?.stopAll();
    this.recordScore(room);
    this.finalizeGame(room, now);
    this.broadcastState(room);
  }

  private recordScore(room: Room): void {
    if (!room.game.result) return;
    room.game.seriesScore[room.game.result.winningTeam]++;
  }

  private handleDisconnect(cs: ClientState): void {
    const { room, seats } = cs;
    if (!room || seats.length === 0) return;
    const stillConnected = [...this.clients.values()].some(
      (other) => other !== cs && other.playerId === cs.playerId && other.room === room,
    );
    if (!stillConnected) {
      room.clients.forEach((c) => {
        if (c.playerId === cs.playerId) room.clients.delete(c);
      });
    }
    if (room.game.status === 'playing') {
      if (stillConnected) return;
      // For simul, trigger disconnect on the primary seat (timer fires per player).
      const primarySeatVal = seats[0]!;
      this.lobby.handleDisconnect(room, primarySeatVal, (r, s) => {
        if (r.game.status !== 'playing') return;
        const now = Date.now();
        r.game.status = 'ended';
        r.game.result = {
          winningTeam: (teamOf(s) === 0 ? 1 : 0) as 0 | 1,
          reason: 'disconnect',
          losingSeat: s,
        };
        this.clocks.get(r.code)?.stopAll();
        this.recordScore(r);
        this.finalizeGame(r, now);
        this.broadcastState(r);
      });
    } else if (room.game.status === 'lobby') {
      const wasOwner = cs.playerId === room.ownerPlayerId;
      for (const seat of seats) room.slots.delete(seat);
      // Clear simul flags if all seats of a team are gone.
      for (const t of [0, 1] as (0 | 1)[]) {
        if (room.simulTeams[t]) {
          const [s0, s1] = t === 0 ? [0, 2] : [1, 3];
          if (!room.slots.has(s0 as Seat) && !room.slots.has(s1 as Seat)) {
            room.simulTeams[t] = false;
          }
        }
      }
      cs.seats = [];
      if (wasOwner) this.lobby.transferOwnership(room);
    }
    this.broadcastState(room);
  }

  private assertPlaying(cs: ClientState): boolean {
    if (!cs.room || cs.seats.length === 0) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return false;
    }
    if (cs.room.game.status !== 'playing') {
      this.send(cs.ws, { type: 'error', reason: 'not-playing' });
      return false;
    }
    return true;
  }

  private broadcastState(room: Room): void {
    const slotInfo = (s: Seat): SeatInfo | null => {
      const slot = room.slots.get(s);
      if (!slot) return null;
      return { name: slot.name, rating: slot.rating, isGuest: slot.userId === null };
    };

    const ownerSeat = this.lobby.getOwnerSeat(room);

    const stateBase = {
      type: 'state' as const,
      game: room.game,
      names: { 0: slotInfo(0), 1: slotInfo(1), 2: slotInfo(2), 3: slotInfo(3) },
      ready: {
        0: room.slots.get(0)?.ready ?? false,
        1: room.slots.get(1)?.ready ?? false,
        2: room.slots.get(2)?.ready ?? false,
        3: room.slots.get(3)?.ready ?? false,
      },
      connected: {
        0: room.slots.get(0)?.connected ?? false,
        1: room.slots.get(1)?.connected ?? false,
        2: room.slots.get(2)?.connected ?? false,
        3: room.slots.get(3)?.connected ?? false,
      },
      events: room.events,
      isPrivate: room.isPrivate,
      isRated: room.isRated,
      ratingChanges: room.ratingChanges ?? null,
      ownerSeat,
      ratingRange: room.ratingRange,
      simulTeams: room.simulTeams,
      allowSimul: room.allowSimul,
    };
    for (const [ws, cs] of this.clients) {
      if (cs.room?.code !== room.code) continue;
      const yourSeats = cs.seats;
      const msg = { ...stateBase, yourSeat: yourSeats[0] ?? null, yourSeats } as S_State;
      this.send(ws, msg);
    }
  }

  private sendToSeats(room: Room, seats: Seat[], msg: ServerMessage): void {
    const seatSet = new Set(seats);
    for (const [ws, cs] of this.clients) {
      if (cs.room?.code === room.code && cs.seats.some((s) => seatSet.has(s))) {
        this.send(ws, msg);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function shouldPersist(room: Room): boolean {
  if (room.events.length < 10) return false;
  let hasB0 = false, hasB1 = false;
  for (const e of room.events) {
    if (e.boardId === 0) hasB0 = true;
    else if (e.boardId === 1) hasB1 = true;
    if (hasB0 && hasB1) return true;
  }
  return false;
}

function snapshotPlayerNames(room: Room): Record<Seat, string> {
  return {
    0: room.slots.get(0)?.name ?? '?',
    1: room.slots.get(1)?.name ?? '?',
    2: room.slots.get(2)?.name ?? '?',
    3: room.slots.get(3)?.name ?? '?',
  };
}
