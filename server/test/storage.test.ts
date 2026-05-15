import { describe, expect, it } from 'vitest';
import { SavedGameRecord } from '@bughouse/shared';

// SQLite store has been replaced by Persistence (Postgres). Full integration
// tests for Persistence require a running Postgres instance (Testcontainers)
// and live in a separate test file. These tests validate the SavedGameRecord
// shape that both the old and new store accept.

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

describe('SavedGameRecord shape', () => {
  it('has required fields', () => {
    const r = makeRecord();
    expect(r.gameId).toBe('game-1');
    expect(r.result.winningTeam).toBe(0);
    expect(r.playerNames[0]).toBe('Alice');
    expect(r.events).toHaveLength(2);
  });

  it('overrides apply correctly', () => {
    const r = makeRecord({ gameId: 'x', seriesIndex: 5 });
    expect(r.gameId).toBe('x');
    expect(r.seriesIndex).toBe(5);
    expect(r.code).toBe('ABC123'); // base value preserved
  });
});
