import { GameResult, GameState, Seat, seatBoard, seatColor } from '@bughouse/shared';

// Manages server-side chess clocks for a single game.
// Clocks are not stored as decrement-per-tick; instead we record the
// timestamp of the last turn-switch and compute remaining time on demand.

export class ClockManager {
  private flagTimers = new Map<Seat, ReturnType<typeof setTimeout>>();

  start(
    gs: GameState,
    now: number,
    onFlag: (seat: Seat) => void,
  ): void {
    gs.startedAt = now;
    gs.lastClockUpdate = now;
    // Schedule flag timers for the two seats currently to-move.
    for (const boardId of [0, 1] as const) {
      const board = gs.boards[boardId];
      const seat = boardId === 0
        ? (board.turn === 'w' ? 0 : 1)
        : (board.turn === 'w' ? 3 : 2);
      this.scheduleFlagTimer(gs, seat as Seat, now, onFlag);
    }
  }

  // Call after a move/drop/promotion to update the clocks. The move was
  // made by `movingSeat`. Restarts the flag timer for the new seat-to-move
  // on that board.
  afterMove(
    gs: GameState,
    movingSeat: Seat,
    now: number,
    onFlag: (seat: Seat) => void,
  ): void {
    if (gs.status !== 'playing') return;

    // Drain the moving seat's clock (time used since lastClockUpdate).
    const elapsed = now - gs.lastClockUpdate;
    const prev = gs.clocks[movingSeat];
    gs.clocks[movingSeat] = Math.max(0, prev - elapsed);
    gs.lastClockUpdate = now;

    // Cancel old flag timer for this seat.
    this.cancelFlagTimer(movingSeat);

    // Schedule flag timer for the new seat-to-move on this board.
    const boardId = seatBoard(movingSeat);
    const board = gs.boards[boardId];
    // Find the new mover seat on this board.
    const newSeat = boardId === 0
      ? (board.turn === 'w' ? 0 : 1)
      : (board.turn === 'w' ? 3 : 2);
    this.scheduleFlagTimer(gs, newSeat as Seat, now, onFlag);
  }

  // Compute remaining time for a seat at `now` (accounting for ongoing tick).
  remainingMs(gs: GameState, seat: Seat, now: number): number {
    const boardId = seatBoard(seat);
    const board = gs.boards[boardId];
    const color = seatColor(seat);
    const isToMove = board.turn === color && gs.status === 'playing';
    if (!isToMove) return gs.clocks[seat];
    const elapsed = now - gs.lastClockUpdate;
    return Math.max(0, gs.clocks[seat] - elapsed);
  }

  stopAll(): void {
    for (const t of this.flagTimers.values()) clearTimeout(t);
    this.flagTimers.clear();
  }

  private scheduleFlagTimer(
    gs: GameState,
    seat: Seat,
    now: number,
    onFlag: (seat: Seat) => void,
  ): void {
    this.cancelFlagTimer(seat);
    const remaining = gs.clocks[seat];
    if (remaining <= 0) {
      onFlag(seat);
      return;
    }
    const t = setTimeout(() => {
      this.flagTimers.delete(seat);
      onFlag(seat);
    }, remaining);
    this.flagTimers.set(seat, t);
  }

  private cancelFlagTimer(seat: Seat): void {
    const t = this.flagTimers.get(seat);
    if (t !== undefined) {
      clearTimeout(t);
      this.flagTimers.delete(seat);
    }
  }
}
