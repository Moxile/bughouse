// SQLite-backed persistence for finished games. The whole event log goes
// inline as a JSON column on the `games` row — we never query individual
// events, and atomic single-row writes keep the lifecycle simple.
//
// Path comes from the DB_PATH env var (default ./data/bughouse.db) or can be
// passed explicitly. Pass ':memory:' for tests.

import Database, { type Database as Db } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GameEvent, GameResult, SavedGameRecord, Seat } from '@bughouse/shared';

export interface GameStore {
  saveGame(record: SavedGameRecord): void;
  getGame(gameId: string): SavedGameRecord | null;
  listRecent(limit?: number): SavedGameRecord[];
  listSeries(seriesId: string): SavedGameRecord[];
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  game_id          TEXT PRIMARY KEY,
  series_id        TEXT NOT NULL,
  series_index     INTEGER NOT NULL,
  code             TEXT NOT NULL,
  started_at       INTEGER NOT NULL,
  ended_at         INTEGER NOT NULL,
  initial_clock_ms INTEGER NOT NULL,
  result_json      TEXT NOT NULL,
  player_names_json TEXT NOT NULL,
  events_json      TEXT NOT NULL,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_games_series      ON games(series_id, series_index);
CREATE INDEX IF NOT EXISTS idx_games_code        ON games(code);
CREATE INDEX IF NOT EXISTS idx_games_started_at  ON games(started_at DESC);
`;

type Row = {
  game_id: string;
  series_id: string;
  series_index: number;
  code: string;
  started_at: number;
  ended_at: number;
  initial_clock_ms: number;
  result_json: string;
  player_names_json: string;
  events_json: string;
  created_at: number;
};

export class SqliteGameStore implements GameStore {
  private db: Db;
  private insert: ReturnType<Db['prepare']>;
  private selectById: ReturnType<Db['prepare']>;
  private selectRecent: ReturnType<Db['prepare']>;
  private selectSeries: ReturnType<Db['prepare']>;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(SCHEMA);

    this.insert = this.db.prepare(`
      INSERT INTO games (
        game_id, series_id, series_index, code,
        started_at, ended_at, initial_clock_ms,
        result_json, player_names_json, events_json, created_at
      ) VALUES (
        @game_id, @series_id, @series_index, @code,
        @started_at, @ended_at, @initial_clock_ms,
        @result_json, @player_names_json, @events_json, @created_at
      )
    `);
    this.selectById   = this.db.prepare(`SELECT * FROM games WHERE game_id = ?`);
    this.selectRecent = this.db.prepare(`SELECT * FROM games ORDER BY started_at DESC LIMIT ?`);
    this.selectSeries = this.db.prepare(`SELECT * FROM games WHERE series_id = ? ORDER BY series_index ASC`);
  }

  saveGame(r: SavedGameRecord): void {
    this.insert.run({
      game_id: r.gameId,
      series_id: r.seriesId,
      series_index: r.seriesIndex,
      code: r.code,
      started_at: r.startedAt,
      ended_at: r.endedAt,
      initial_clock_ms: r.initialClockMs,
      result_json: JSON.stringify(r.result),
      player_names_json: JSON.stringify(r.playerNames),
      events_json: JSON.stringify(r.events),
      created_at: Date.now(),
    });
  }

  getGame(gameId: string): SavedGameRecord | null {
    const row = this.selectById.get(gameId) as Row | undefined;
    return row ? rowToRecord(row) : null;
  }

  listRecent(limit = 50): SavedGameRecord[] {
    return (this.selectRecent.all(limit) as Row[]).map(rowToRecord);
  }

  listSeries(seriesId: string): SavedGameRecord[] {
    return (this.selectSeries.all(seriesId) as Row[]).map(rowToRecord);
  }

  close(): void {
    this.db.close();
  }
}

function rowToRecord(r: Row): SavedGameRecord {
  return {
    gameId: r.game_id,
    seriesId: r.series_id,
    seriesIndex: r.series_index,
    code: r.code,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    initialClockMs: r.initial_clock_ms,
    result: JSON.parse(r.result_json) as GameResult,
    playerNames: JSON.parse(r.player_names_json) as Record<Seat, string>,
    events: JSON.parse(r.events_json) as GameEvent[],
  };
}
