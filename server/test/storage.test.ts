import { describe, expect, it } from 'vitest';
import { SqliteGameStore } from '../src/storage/SqliteGameStore.js';
import { SavedGameRecord } from '@bughouse/shared';

function makeRecord(overrides: Partial<SavedGameRecord> = {}): SavedGameRecord {
  return {
    gameId: 'game-1',
    seriesId: 'series-1',
    seriesIndex: 1,
    code: 'ABC123',
    startedAt: 1000,
    endedAt: 2000,
    initialClockMs: 5 * 60 * 1000,
    result: { winningTeam: 0, reason: 'checkmate', losingSeat: 1, boardId: 0 },
    playerNames: { 0: 'Alice', 1: 'Bob', 2: 'Carol', 3: 'Dave' },
    events: [
      { kind: 'move', seq: 1, ts: 1100, boardId: 0, seat: 0, from: 12, to: 28 },
      { kind: 'move', seq: 2, ts: 1200, boardId: 0, seat: 1, from: 52, to: 36 },
    ],
    ...overrides,
  };
}

describe('SqliteGameStore', () => {
  it('roundtrips a saved game', () => {
    const store = new SqliteGameStore(':memory:');
    const r = makeRecord();
    store.saveGame(r);
    expect(store.getGame(r.gameId)).toEqual(r);
    store.close();
  });

  it('returns null for missing gameId', () => {
    const store = new SqliteGameStore(':memory:');
    expect(store.getGame('nope')).toBeNull();
    store.close();
  });

  it('lists recent games newest-first by startedAt', () => {
    const store = new SqliteGameStore(':memory:');
    store.saveGame(makeRecord({ gameId: 'a', startedAt: 1000 }));
    store.saveGame(makeRecord({ gameId: 'b', startedAt: 3000 }));
    store.saveGame(makeRecord({ gameId: 'c', startedAt: 2000 }));
    expect(store.listRecent().map((g) => g.gameId)).toEqual(['b', 'c', 'a']);
    store.close();
  });

  it('lists a series ordered by seriesIndex ascending', () => {
    const store = new SqliteGameStore(':memory:');
    store.saveGame(makeRecord({ gameId: 'a', seriesId: 's1', seriesIndex: 2 }));
    store.saveGame(makeRecord({ gameId: 'b', seriesId: 's1', seriesIndex: 1 }));
    store.saveGame(makeRecord({ gameId: 'c', seriesId: 's2', seriesIndex: 1 }));
    expect(store.listSeries('s1').map((g) => g.gameId)).toEqual(['b', 'a']);
    expect(store.listSeries('s2').map((g) => g.gameId)).toEqual(['c']);
    store.close();
  });
});
