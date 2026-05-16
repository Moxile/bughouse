import { useEffect, useRef } from 'react';
import { BoardId, GameState, Seat } from '@bughouse/shared';
import { inCheck } from '../lib/legalMoves.js';
import { useClock } from './useClock.js';
import { SoundSetKey, playSound } from '../sounds.js';

function getAudioCtx(ref: { current: AudioContext | null }): AudioContext {
  if (!ref.current) ref.current = new AudioContext();
  if (ref.current.state === 'suspended') void ref.current.resume();
  return ref.current;
}

export function useGameSounds(
  game: GameState | null,
  yourSeat: Seat | null,
  soundSet: SoundSetKey,
  muted: boolean,
) {
  const acRef = useRef<AudioContext | null>(null);
  const prevGameRef = useRef<GameState | null>(null);
  const prevClockSecRef = useRef<number | null>(null);

  const clockMs = useClock(game, (yourSeat ?? 0) as Seat);

  // Detect move / capture / check on both boards
  useEffect(() => {
    const prev = prevGameRef.current;
    prevGameRef.current = game;

    if (!game || game.status !== 'playing') return;
    if (!prev || prev.status !== 'playing') return;
    if (muted) return;

    const ac = getAudioCtx(acRef);

    for (const boardId of [0, 1] as BoardId[]) {
      const board = game.boards[boardId];
      const prevBoard = prev.boards[boardId];
      const lm = board.lastMove;
      const prevLm = prevBoard.lastMove;

      const changed =
        (lm === null) !== (prevLm === null) ||
        (lm !== null && prevLm !== null && (lm.from !== prevLm.from || lm.to !== prevLm.to));
      if (!changed || !lm) continue;

      const isCapture =
        lm.from !== lm.to &&
        (prevBoard.board[lm.to] !== null ||
          (lm.to === prevBoard.enPassant && prevBoard.board[lm.from]?.type === 'P'));

      if (inCheck(board, board.turn)) {
        playSound(ac, soundSet, 'check');
      } else if (isCapture) {
        playSound(ac, soundSet, 'capture');
      } else {
        playSound(ac, soundSet, 'move');
      }
    }
  }, [game, soundSet, muted]);

  // Tick once per second when your clock is below 20 s and running
  useEffect(() => {
    if (!game || game.status !== 'playing' || yourSeat === null) {
      prevClockSecRef.current = null;
      return;
    }
    if (muted || clockMs <= 0 || clockMs > 20_000) {
      prevClockSecRef.current = null;
      return;
    }
    const sec = Math.ceil(clockMs / 1000);
    if (sec !== prevClockSecRef.current) {
      prevClockSecRef.current = sec;
      const urgency = 1 - clockMs / 20_000;
      playSound(getAudioCtx(acRef), soundSet, 'tick', urgency);
    }
  }, [clockMs, game, yourSeat, soundSet, muted]);
}
