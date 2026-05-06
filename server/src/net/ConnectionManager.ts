import { WebSocket } from 'ws';
import {
  ClientMessage,
  GameState,
  S_Chat,
  S_Error,
  S_State,
  S_Welcome,
  Seat,
  ServerMessage,
  partnerOf,
  teamOf,
} from '@bughouse/shared';
import { LobbyManager, Room } from '../game/LobbyManager.js';
import { ClockManager } from '../game/ClockManager.js';
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
};

export class ConnectionManager {
  private lobby = new LobbyManager();
  // Map from ws -> client state.
  private clients = new Map<WebSocket, ClientState>();
  // Map from room.code -> ClockManager.
  private clocks = new Map<string, ClockManager>();

  handleConnection(ws: WebSocket): void {
    const cs: ClientState = { ws, playerId: null, seat: null, room: null, name: null };
    this.clients.set(ws, cs);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleMessage(cs, msg);
      } catch {
        this.send(ws, { type: 'error', reason: 'invalid-message' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(cs);
      this.clients.delete(ws);
    });
  }

  createRoom(): string {
    const room = this.lobby.createRoom();
    return room.code;
  }

  private handleMessage(cs: ClientState, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join': return this.handleJoin(cs, msg);
      case 'claim-seat': return this.handleClaimSeat(cs, msg);
      case 'ready': return this.handleReady(cs);
      case 'move': return this.handleMove(cs, msg);
      case 'drop': return this.handleDrop(cs, msg);
      case 'promotion-select': return this.handlePromotionSelect(cs, msg);
      case 'cancel-promotion': return this.handlePromotionCancel(cs);
      case 'resign': return this.handleResign(cs);
      case 'chat': return this.handleChat(cs, msg);
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

  private startGame(room: Room): void {
    const now = Date.now();
    room.game.status = 'playing';
    const cm = new ClockManager();
    this.clocks.set(room.code, cm);
    cm.start(room.game, now, (seat) => this.handleFlag(room, seat));
    this.broadcastState(room);
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
      if (room.game.status === 'ended') {
        cm.stopAll();
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
    try {
      applyGamePromotion(room.game, seat, msg.diagonalSquare);
      const cm = this.clocks.get(room.code)!;
      cm.afterMove(room.game, seat, now, (s) => this.handleFlag(room, s));
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
    room.game.status = 'ended';
    room.game.result = {
      winningTeam: (teamOf(seat) === 0 ? 1 : 0) as 0 | 1,
      reason: 'resign',
      losingSeat: seat,
    };
    this.clocks.get(room.code)?.stopAll();
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
    room.game.status = 'ended';
    room.game.result = {
      winningTeam: (teamOf(seat) === 0 ? 1 : 0) as 0 | 1,
      reason: 'time',
      losingSeat: seat,
    };
    this.clocks.get(room.code)?.stopAll();
    this.broadcastState(room);
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
        r.game.status = 'ended';
        r.game.result = {
          winningTeam: (teamOf(s) === 0 ? 1 : 0) as 0 | 1,
          reason: 'disconnect',
          losingSeat: s,
        };
        this.clocks.get(r.code)?.stopAll();
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
