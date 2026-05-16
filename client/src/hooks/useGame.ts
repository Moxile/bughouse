import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSocket } from '../lib/ws.js';
import { S_State, S_Chat, ClientMessage } from '@bughouse/shared';

export type GameStore = S_State & {
  errors: string[];
  chatMessages: S_Chat[];
};

const EMPTY: GameStore = {
  type: 'state',
  game: null as any,
  yourSeat: null,
  yourSeats: [] as any,
  simulTeams: { 0: false, 1: false } as any,
  allowSimul: false as any,
  names: { 0: null, 1: null, 2: null, 3: null },
  ready: { 0: false, 1: false, 2: false, 3: false },
  connected: { 0: false, 1: false, 2: false, 3: false },
  events: [],
  isPrivate: false,
  isRated: true,
  ratingChanges: null,
  ownerSeat: null,
  ratingRange: null,
  errors: [],
  chatMessages: [],
};

export function useGame(code: string) {
  const socketRef = useRef<GameSocket | null>(null);
  const [store, setStore] = useState<GameStore>(EMPTY);

  useEffect(() => {
    const sock = new GameSocket();
    socketRef.current = sock;
    sock.connect(code);
    const off = sock.onMessage((msg) => {
      if (msg.type === 'state') {
        setStore((prev) => ({ ...prev, ...(msg as S_State) }));
      } else if (msg.type === 'error') {
        setStore((prev) => ({
          ...prev,
          errors: [...prev.errors.slice(-4), msg.reason],
        }));
        // Auto-clear error after 3s.
        setTimeout(() => {
          setStore((p) => ({ ...p, errors: p.errors.slice(1) }));
        }, 3000);
      } else if (msg.type === 'chat') {
        setStore((prev) => ({
          ...prev,
          chatMessages: [...prev.chatMessages.slice(-99), msg],
        }));
      }
    });
    return () => {
      off();
      sock.close();
    };
  }, [code]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(msg);
  }, []);

  return { store, send };
}
