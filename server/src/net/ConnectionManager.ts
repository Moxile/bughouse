import { WebSocket } from 'ws';
import {
  ClientMessage,
  GameEvent,
  GameEventDrop,
  GameEventMove,
  GameState,
  S_Chat,
  S_Error,
  S_State,
  S_Welcome,
  SavedGameRecord,
  Seat,
  SEATS,
  ServerMessage,
  createGameState,
  isValidSeat,
  partnerOf,
  seatBoard,
  teamOf,
  validateClientMessage,
} from '@bughouse/shared';
import { GameStore } from '../storage/SqliteGameStore.js';
import { LobbyManager, Room } from '../game/LobbyManager.js';
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
  seat: Seat | null;
  room: Room | null;
  name: string | null;
  // Per-connection inbound bucket. Bounds the cost of broadcastState fan-out
  // and protects against a misbehaving or malicious client flooding moves.
  bucket: TokenBucket;
};

// 30 burst, 10 messages/sec sustained. Comfortably above any human play rate.
const INBOUND_BURST = 30;
const INBOUND_PER_SEC = 10;

const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ROOMS = 5000;

export class ConnectionManager {
  private lobby = new LobbyManager();
  // Map from ws -> client state.
  private clients = new Map<WebSocket, ClientState>();
  // Map from room.code -> ClockManager.
  private clocks = new Map<string, ClockManager>();

  constructor(private readonly store: GameStore | null = null) {
    setInterval(() => this.pruneRooms(), PRUNE_INTERVAL_MS);
  }

  private pruneRooms(): void {
    const deleted = this.lobby.pruneIdleRooms();
    for (const code of deleted) {
      this.clocks.get(code)?.stopAll();
      this.clocks.delete(code);
    }
  }

  handleConnection(ws: WebSocket): void {
    const cs: ClientState = {
      ws,
      playerId: null,
      seat: null,
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

  createRoom(): string | null {
    if (this.lobby.roomCount() >= MAX_ROOMS) return null;
    const room = this.lobby.createRoom();
    return room.code;
  }

  listRooms(): { code: string; status: string; players: (string | null)[] }[] {
    return this.lobby.allRooms()
      .filter((r) => r.game.status !== 'ended')
      .map((r) => ({
        code: r.code,
        status: r.game.status,
        players: ([0, 1, 2, 3] as Seat[]).map((s) => r.slots.get(s)?.name ?? null),
      }));
  }

  private handleMessage(cs: ClientState, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join': return this.handleJoin(cs, msg);
      case 'claim-seat': return this.handleClaimSeat(cs, msg);
      case 'release-seat': return this.handleReleaseSeat(cs);
      case 'ready': return this.handleReady(cs);
      case 'unready': return this.handleUnready(cs);
      case 'move': return this.handleMove(cs, msg);
      case 'drop': return this.handleDrop(cs, msg);
      case 'promotion-select': return this.handlePromotionSelect(cs, msg);
      case 'cancel-promotion': return this.handlePromotionCancel(cs);
      case 'resign': return this.handleResign(cs);
      case 'chat': return this.handleChat(cs, msg);
      case 'rematch': return this.handleRematch(cs);
      case 'new-seating': return this.handleNewSeating(cs);
      case 'set-time-control': return this.handleSetTimeControl(cs, msg);
    }
  }

  private handleJoin(cs: ClientState, msg: { code: string; playerId?: string; name: string }): void {
    const room = this.lobby.getRoom(msg.code.toUpperCase());
    if (!room) {
      this.send(cs.ws, { type: 'error', reason: 'room-not-found' });
      return;
    }

    // Assign or restore playerId.
    const playerId = msg.playerId ?? randomUUID();
    cs.playerId = playerId;
    cs.name = msg.name.trim().slice(0, 20) || 'Player';
    cs.room = room;
    room.clients.add({ seat: cs.seat, playerId });

    // If reconnecting to an existing seat:
    if (msg.playerId) {
      for (const slot of room.slots.values()) {
        if (slot.playerId === msg.playerId) {
          cs.seat = slot.seat;
          this.lobby.handleReconnect(room, slot.seat);
          break;
        }
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
    const slot = this.lobby.claimSeat(cs.room, msg.seat, cs.name, cs.playerId);
    if (!slot) {
      this.send(cs.ws, { type: 'error', reason: 'seat-taken' });
      return;
    }
    cs.seat = msg.seat;
    this.broadcastState(cs.room);
  }

  private handleReleaseSeat(cs: ClientState): void {
    if (!cs.room || cs.seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (cs.room.game.status !== 'lobby') {
      this.send(cs.ws, { type: 'error', reason: 'game-in-progress' });
      return;
    }
    cs.room.slots.delete(cs.seat);
    cs.seat = null;
    this.broadcastState(cs.room);
  }

  private handleReady(cs: ClientState): void {
    if (!cs.room || cs.seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    const allReady = this.lobby.setReady(cs.room, cs.seat);
    if (allReady) {
      this.startGame(cs.room);
    } else {
      this.broadcastState(cs.room);
    }
  }

  private handleUnready(cs: ClientState): void {
    if (!cs.room || cs.seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
      return;
    }
    if (cs.room.game.status !== 'lobby') return;
    this.lobby.setUnready(cs.room, cs.seat);
    this.broadcastState(cs.room);
  }

  private handleSetTimeControl(cs: ClientState, msg: { minutes: number }): void {
    if (!cs.room || cs.seat === null) {
      this.send(cs.ws, { type: 'error', reason: 'no-seat' });
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

  // Append an event to the room's in-memory journal, assigning it the next
  // 1-based seq. Overloads keep per-kind field-narrowing at call sites.
  private appendEvent(room: Room, ev: Omit<GameEventMove, 'seq'>): void;
  private appendEvent(room: Room, ev: Omit<GameEventDrop, 'seq'>): void;
  private appendEvent(room: Room, ev: Omit<GameEvent, 'seq'>): void {
    room.events.push({ ...ev, seq: room.events.length + 1 } as GameEvent);
  }

  // Persist a finished game if it meets the bar. Called from every end path
  // (mate / king-capture inside a move, resign, flag, disconnect). Bumps the
  // room's seriesIndex only when a save actually happens — so series numbering
  // stays dense across drop-outs.
  private finalizeGame(room: Room, endedAt: number): void {
    if (!this.store) return;
    if (!shouldPersist(room)) return;
    if (!room.game.startedAt || !room.game.result) return;

    const nextIndex = room.seriesIndex + 1;
    const record: SavedGameRecord = {
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
    };
    try {
      this.store.saveGame(record);
      room.seriesIndex = nextIndex;
      console.log(
        `[store] saved game ${record.gameId} (room ${room.code}, ` +
        `series ${room.seriesId.slice(0, 8)} #${nextIndex}, ${record.events.length} events)`,
      );
    } catch (e) {
      console.error(`[store] failed to save game for room ${room.code}:`, e);
    }
  }

  private handleMove(cs: ClientState, msg: { boardId: number; from: number; to: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const seat = cs.seat!;
    const now = Date.now();
    try {
      const out = applyGameMove(room.game, seat, { from: msg.from, to: msg.to });
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
      // Defer logging if this move triggered a promotion: the event will be
      // written atomically when the player picks the promoted piece.
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
    const seat = cs.seat!;
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

  private handlePromotionSelect(cs: ClientState, msg: { diagonalSquare: number }): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const seat = cs.seat!;
    const now = Date.now();
    // Capture the originating pawn move before applying — `applyGamePromotion`
    // clears `pendingPromotion`, so we can't read it afterwards.
    const boardId = seatBoard(seat);
    const pending = room.game.boards[boardId].pendingPromotion;
    try {
      const out = applyGamePromotion(room.game, seat, msg.diagonalSquare);
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
      // Atomic move-with-promotion event. `pending` is guaranteed to be set
      // here because applyGamePromotion would have thrown otherwise.
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

  private handlePromotionCancel(cs: ClientState): void {
    if (!this.assertPlaying(cs)) return;
    const room = cs.room!;
    const seat = cs.seat!;
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
    const seat = cs.seat!;
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
    if (!cs.room || cs.seat === null) return;
    const room = cs.room;
    if (room.game.status !== 'ended') return;

    room.game.rematchVotes[cs.seat] = true;

    const allVoted =
      room.slots.size === 4 &&
      SEATS.every((s) => room.game.rematchVotes[s]);

    if (allVoted) {
      this.startRematch(room);
    } else {
      this.broadcastState(room);
    }
  }

  // Drop the room back to the seating lobby. Unilateral: any seated player
  // triggers this for everyone in the room (including spectators). Seats are
  // preserved so partners who don't want to swap just hit Ready again; anyone
  // who does want to move can release their seat from the lobby UI.
  private handleNewSeating(cs: ClientState): void {
    if (!cs.room || cs.seat === null) return;
    const room = cs.room;
    if (room.game.status !== 'ended') return;

    // Stop any clock activity from the just-finished game.
    this.clocks.get(room.code)?.stopAll();
    this.clocks.delete(room.code);

    // Fresh game state, but stay in the lobby. Preserve the previously
    // configured time control so players don't have to re-set it.
    const prevClockMs = room.game.initialClockMs;
    room.game = createGameState(room.code, Date.now(), prevClockMs);
    room.events = [];

    // Keep all existing seat assignments (names, playerIds, connected status)
    // but mark everyone unready for the next game.
    for (const slot of room.slots.values()) {
      slot.ready = false;
    }

    this.broadcastState(room);
  }

  private startRematch(room: Room): void {
    const now = Date.now();

    // Swap seats within each board: 0↔1 (Board 0), 2↔3 (Board 1).
    // This keeps the same team matchup but flips colors on each board.
    const swapMap: Record<Seat, Seat> = { 0: 1, 1: 0, 2: 3, 3: 2 };
    const newSlots = new Map<Seat, import('../game/LobbyManager.js').PlayerSlot>();
    for (const [seat, slot] of room.slots) {
      const newSeat = swapMap[seat];
      newSlots.set(newSeat, { ...slot, seat: newSeat, ready: false });
    }
    room.slots = newSlots;

    // Update seat on every active client connection.
    for (const [, cs] of this.clients) {
      if (cs.room?.code === room.code && cs.seat !== null) {
        cs.seat = swapMap[cs.seat];
      }
    }

    // Preserve series score across rematches.
    const prevScore: [number, number] = [room.game.seriesScore[0], room.game.seriesScore[1]];

    // Replace game state with a fresh game, started immediately.
    room.game = createGameState(room.code, now);
    room.game.seriesScore = prevScore;
    room.game.status = 'playing';
    room.game.startedAt = now;
    room.game.lastClockUpdate = [now, now];
    room.events = [];

    // Reset clock manager.
    this.clocks.get(room.code)?.stopAll();
    const cm = new ClockManager();
    this.clocks.set(room.code, cm);
    cm.start(room.game, now, (seat) => this.handleFlag(room, seat));

    this.broadcastState(room);
  }

  private handleChat(cs: ClientState, msg: { text: string }): void {
    if (!cs.room || cs.seat === null) return;
    const text = msg.text.trim().slice(0, 200);
    if (!text) return;
    const slot = cs.room.slots.get(cs.seat);
    if (!slot) return;
    // Chat is partner-only: send only to the partner and the sender.
    const partner = partnerOf(cs.seat);
    const chatMsg: S_Chat = {
      type: 'chat',
      fromSeat: cs.seat,
      fromName: slot.name,
      text,
    };
    // Find partner's ws and send; also send to self.
    this.sendToSeats(cs.room, [cs.seat, partner], chatMsg);
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
    const { room, seat } = cs;
    if (!room || seat === null) return;
    room.clients.forEach((c) => {
      if (c.playerId === cs.playerId) room.clients.delete(c);
    });
    if (room.game.status === 'playing') {
      this.lobby.handleDisconnect(room, seat, (r, s) => {
        // 30s timeout: forfeit.
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
      // In lobby: just remove the slot so someone else can take the seat.
      room.slots.delete(seat);
    }
    this.broadcastState(room);
  }

  private assertPlaying(cs: ClientState): boolean {
    if (!cs.room || cs.seat === null) {
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
    const stateBase: Omit<S_State, 'yourSeat'> = {
      type: 'state',
      game: room.game,
      names: {
        0: room.slots.get(0)?.name ?? null,
        1: room.slots.get(1)?.name ?? null,
        2: room.slots.get(2)?.name ?? null,
        3: room.slots.get(3)?.name ?? null,
      },
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
    };
    // Send personalised copy to each client.
    for (const [ws, cs] of this.clients) {
      if (cs.room?.code !== room.code) continue;
      const msg: S_State = { ...stateBase, yourSeat: cs.seat };
      this.send(ws, msg);
    }
  }

  private sendToSeats(room: Room, seats: Seat[], msg: ServerMessage): void {
    const seatSet = new Set(seats);
    for (const [ws, cs] of this.clients) {
      if (cs.room?.code === room.code && cs.seat !== null && seatSet.has(cs.seat)) {
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

// Filter for which finished games are worth keeping. Tunable as the product
// matures; current rules: at least 10 logged actions and at least one on each
// board (rules out cases where one team never moved).
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

// Snapshot whatever names sit in the room's slots right now. Stored on the
// SavedGameRecord so post-game roster shuffles (release-seat / new-seating
// substitutes) don't rewrite history.
function snapshotPlayerNames(room: Room): Record<Seat, string> {
  return {
    0: room.slots.get(0)?.name ?? '?',
    1: room.slots.get(1)?.name ?? '?',
    2: room.slots.get(2)?.name ?? '?',
    3: room.slots.get(3)?.name ?? '?',
  };
}
