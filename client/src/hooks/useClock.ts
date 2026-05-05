import { useEffect, useState } from 'react';
import { GameState, Seat, seatBoard, seatColor } from '@bughouse/shared';

export function useClock(game: GameState | null, seat: Seat): number {
  const [ms, setMs] = useState(game?.clocks[seat] ?? 0);

  useEffect(() => {
    if (!game || game.status !== 'playing') {
      setMs(game?.clocks[seat] ?? 0);
      return;
    }
    const boardId = seatBoard(seat);
    const board = game.boards[boardId];
    const color = seatColor(seat);
    const isToMove = board.turn === color;

    if (!isToMove) {
      setMs(game.clocks[seat]);
      return;
    }
    // Tick every 100ms while this seat is to-move.
    const update = () => {
      const elapsed = Date.now() - game.lastClockUpdate;
      setMs(Math.max(0, game.clocks[seat] - elapsed));
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [game, seat]);

  return ms;
}

export function formatClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
