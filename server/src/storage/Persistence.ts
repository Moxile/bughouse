import postgres from 'postgres';
import { createHash, randomBytes } from 'node:crypto';
import {
  GameEvent,
  GameResult,
  RatingChange,
  SavedGameRecord,
  Seat,
  applyElo,
  kFactor,
  teamAverage,
} from '@bughouse/shared';
import { runMigrations } from './migrate.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  rating: number;
  ratingGamesPlayed: number;
};

// ---------------------------------------------------------------------------
// Persistence facade
// ---------------------------------------------------------------------------

export class Persistence {
  constructor(private readonly sql: postgres.Sql) {}

  static async connect(url: string): Promise<Persistence> {
    const sql = postgres(url, { max: 5 });
    await runMigrations(sql);
    return new Persistence(sql);
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  // ---- Games ----------------------------------------------------------------

  // Saves a completed game. If all 4 seats have authenticated user IDs,
  // computes and applies Elo updates inside the same transaction.
  // Returns the rating changes (for broadcast) or null (unrated game).
  async saveGame(
    record: SavedGameRecord,
    seatUserIds: Record<Seat, string | null>,
    isRated = true,
  ): Promise<Record<Seat, RatingChange> | null> {
    const allAuthed = ([0, 1, 2, 3] as Seat[]).every((s) => seatUserIds[s] !== null);
    const shouldRate = allAuthed && isRated;

    let ratingChanges: Record<Seat, RatingChange> | null = null;

    await this.sql.begin(async (tx) => {
      await tx`
        INSERT INTO games (
          game_id, series_id, series_index, code,
          started_at, ended_at, initial_clock_ms,
          result, player_names, events, rated
        ) VALUES (
          ${record.gameId}, ${record.seriesId}, ${record.seriesIndex}, ${record.code},
          ${new Date(record.startedAt)}, ${new Date(record.endedAt)}, ${record.initialClockMs},
          ${tx.json(record.result)}, ${tx.json(record.playerNames)}, ${tx.json(record.events)},
          ${shouldRate}
        )
      `;

      for (const s of [0, 1, 2, 3] as Seat[]) {
        await tx`
          INSERT INTO game_seats (game_id, seat, user_id)
          VALUES (${record.gameId}, ${s}, ${seatUserIds[s]})
        `;
      }

      if (shouldRate) {
        const userIds = ([0, 1, 2, 3] as Seat[]).map((s) => seatUserIds[s]!);
        const users = await tx<{ id: string; rating: number; rating_games_played: number }[]>`
          SELECT id, rating, rating_games_played
          FROM users
          WHERE id = ANY(${userIds})
          FOR UPDATE
        `;
        const userMap = new Map(users.map((u) => [u.id, u]));

        const winningTeam = record.result.winningTeam;
        // team 0 = seats {0,2}, team 1 = seats {1,3}
        const team0Avg = teamAverage(
          userMap.get(seatUserIds[0]!)?.rating ?? 1200,
          userMap.get(seatUserIds[2]!)?.rating ?? 1200,
        );
        const team1Avg = teamAverage(
          userMap.get(seatUserIds[1]!)?.rating ?? 1200,
          userMap.get(seatUserIds[3]!)?.rating ?? 1200,
        );

        const changes: Partial<Record<Seat, RatingChange>> = {};

        for (const seat of [0, 1, 2, 3] as Seat[]) {
          const userId = seatUserIds[seat]!;
          const user = userMap.get(userId);
          if (!user) continue;

          const seatTeam = seat === 0 || seat === 2 ? 0 : 1;
          const won = seatTeam === winningTeam;
          const oppAvg = seatTeam === 0 ? team1Avg : team0Avg;
          const k = kFactor(user.rating_games_played);
          const newRating = applyElo(user.rating, oppAvg, won, k);
          const delta = newRating - user.rating;

          await tx`
            UPDATE users
            SET rating = ${newRating},
                rating_games_played = rating_games_played + 1,
                updated_at = now()
            WHERE id = ${userId}
          `;

          await tx`
            INSERT INTO rating_history (
              user_id, game_id, seat,
              rating_before, rating_after, delta,
              opponent_team_avg, k_factor
            ) VALUES (
              ${userId}, ${record.gameId}, ${seat},
              ${user.rating}, ${newRating}, ${delta},
              ${oppAvg}, ${k}
            )
          `;

          changes[seat] = { before: user.rating, after: newRating, delta };
        }

        ratingChanges = changes as Record<Seat, RatingChange>;
      }
    });

    return ratingChanges;
  }

  async getGame(gameId: string): Promise<SavedGameRecord | null> {
    const rows = await this.sql<GameRow[]>`
      SELECT * FROM games WHERE game_id = ${gameId}
    `;
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async listRecent(limit = 50): Promise<SavedGameRecord[]> {
    const rows = await this.sql<GameRow[]>`
      SELECT * FROM games ORDER BY started_at DESC LIMIT ${limit}
    `;
    return rows.map(rowToRecord);
  }

  // ---- Users ----------------------------------------------------------------

  async createUser(params: {
    username: string;
    email: string | null;
    displayName: string;
    passwordHash: string | null;
  }): Promise<UserRow> {
    const rows = await this.sql<UserRow[]>`
      INSERT INTO users (username, email, display_name, password_hash)
      VALUES (${params.username}, ${params.email}, ${params.displayName}, ${params.passwordHash})
      RETURNING id, username, email, display_name AS "displayName",
                rating, rating_games_played AS "ratingGamesPlayed"
    `;
    return rows[0]!;
  }

  async getUserByUsername(username: string): Promise<(UserRow & {
    passwordHash: string | null;
    failedLoginCount: number;
    lockedUntil: Date | null;
  }) | null> {
    const rows = await this.sql<(UserRow & {
      passwordHash: string | null;
      failedLoginCount: number;
      lockedUntil: Date | null;
    })[]>`
      SELECT id, username, email, display_name AS "displayName",
             rating, rating_games_played AS "ratingGamesPlayed",
             password_hash AS "passwordHash",
             failed_login_count AS "failedLoginCount",
             locked_until AS "lockedUntil"
      FROM users
      WHERE username = ${username}
    `;
    return rows[0] ?? null;
  }

  async getUserById(id: string): Promise<UserRow | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, username, email, display_name AS "displayName",
             rating, rating_games_played AS "ratingGamesPlayed"
      FROM users WHERE id = ${id}
    `;
    return rows[0] ?? null;
  }

  async recordLoginFailure(userId: string): Promise<void> {
    await this.sql`
      UPDATE users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= 5
            THEN now() + interval '15 minutes'
            ELSE locked_until
          END,
          updated_at = now()
      WHERE id = ${userId}
    `;
  }

  async clearLoginFailures(userId: string): Promise<void> {
    await this.sql`
      UPDATE users
      SET failed_login_count = 0, locked_until = NULL, updated_at = now()
      WHERE id = ${userId}
    `;
  }

  async listLeaderboard(limit = 50): Promise<UserRow[]> {
    return this.sql<UserRow[]>`
      SELECT id, username, email, display_name AS "displayName",
             rating, rating_games_played AS "ratingGamesPlayed"
      FROM users
      WHERE rating_games_played > 0
      ORDER BY rating DESC
      LIMIT ${limit}
    `;
  }

  async getRatingHistory(userId: string, limit = 50): Promise<{
    gameId: string;
    ratingBefore: number;
    ratingAfter: number;
    delta: number;
    createdAt: Date;
  }[]> {
    return this.sql`
      SELECT game_id AS "gameId", rating_before AS "ratingBefore",
             rating_after AS "ratingAfter", delta, created_at AS "createdAt"
      FROM rating_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  // ---- Sessions -------------------------------------------------------------

  async createSession(params: {
    userId: string;
    expiresAt: Date;
    userAgent: string | null;
    ip: string | null;
  }): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    const hash = hashToken(raw);
    await this.sql`
      INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip)
      VALUES (${hash}, ${params.userId}, ${params.expiresAt}, ${params.userAgent}, ${params.ip})
    `;
    return raw;
  }

  async getSession(rawToken: string): Promise<(UserRow & { sessionExpiresAt: Date }) | null> {
    const hash = hashToken(rawToken);
    const rows = await this.sql<(UserRow & { sessionExpiresAt: Date })[]>`
      SELECT u.id, u.username, u.email, u.display_name AS "displayName",
             u.rating, u.rating_games_played AS "ratingGamesPlayed",
             s.expires_at AS "sessionExpiresAt"
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${hash}
        AND s.expires_at > now()
    `;
    if (!rows[0]) return null;
    await this.sql`
      UPDATE sessions
      SET last_used_at = now(),
          expires_at = GREATEST(expires_at, now() + interval '7 days')
      WHERE token_hash = ${hash}
    `;
    return rows[0];
  }

  async deleteSession(rawToken: string): Promise<void> {
    const hash = hashToken(rawToken);
    await this.sql`DELETE FROM sessions WHERE token_hash = ${hash}`;
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.sql`DELETE FROM sessions WHERE user_id = ${userId}`;
  }

  // ---- OAuth ----------------------------------------------------------------

  // Find or create a user from an OAuth login. Returns the resolved user.
  async upsertOAuthUser(params: {
    provider: 'google';
    providerUserId: string;
    email: string | null;
    displayName: string;
  }): Promise<UserRow> {
    // 1. Existing OAuth account for this provider + provider_user_id?
    const existing = await this.sql<(UserRow & { userId: string })[]>`
      SELECT u.id, u.username, u.email, u.display_name AS "displayName",
             u.rating, u.rating_games_played AS "ratingGamesPlayed"
      FROM oauth_accounts oa
      JOIN users u ON u.id = oa.user_id
      WHERE oa.provider = ${params.provider}
        AND oa.provider_user_id = ${params.providerUserId}
    `;
    if (existing[0]) return existing[0];

    // 2. Existing user with the same email → link without creating a new account.
    if (params.email) {
      const byEmail = await this.sql<UserRow[]>`
        SELECT id, username, email, display_name AS "displayName",
               rating, rating_games_played AS "ratingGamesPlayed"
        FROM users WHERE email = ${params.email}
      `;
      if (byEmail[0]) {
        await this.sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email_at_provider)
          VALUES (${byEmail[0].id}, ${params.provider}, ${params.providerUserId}, ${params.email})
          ON CONFLICT DO NOTHING
        `;
        return byEmail[0];
      }
    }

    // 3. Brand-new user.
    const username = await this.uniqueUsername(params.displayName, params.email);
    const rows = await this.sql<UserRow[]>`
      INSERT INTO users (username, email, display_name, password_hash)
      VALUES (${username}, ${params.email}, ${params.displayName}, NULL)
      RETURNING id, username, email, display_name AS "displayName",
                rating, rating_games_played AS "ratingGamesPlayed"
    `;
    const user = rows[0]!;
    await this.sql`
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email_at_provider)
      VALUES (${user.id}, ${params.provider}, ${params.providerUserId}, ${params.email})
    `;
    return user;
  }

  async updateUsername(userId: string, username: string): Promise<{ ok: boolean; error?: 'taken' | 'invalid' }> {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return { ok: false, error: 'invalid' };
    try {
      const rows = await this.sql`
        UPDATE users SET username = ${username} WHERE id = ${userId} RETURNING id
      `;
      return rows.length > 0 ? { ok: true } : { ok: false };
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === '23505') return { ok: false, error: 'taken' };
      throw e;
    }
  }

  private async uniqueUsername(displayName: string, email: string | null): Promise<string> {
    // Derive a base slug from display name or email prefix.
    const base = (displayName || email?.split('@')[0] || 'player')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'player';

    // Check if base is already taken; if so, append a number.
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = attempt === 0 ? base : `${base}_${attempt}`;
      const taken = await this.sql`SELECT 1 FROM users WHERE username = ${candidate}`;
      if (taken.length === 0) return candidate;
    }
    // Fallback: base + random suffix.
    return `${base}_${Math.random().toString(36).slice(2, 6)}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string): Buffer {
  return createHash('sha256').update(raw).digest();
}

type GameRow = {
  game_id: string;
  series_id: string;
  series_index: number;
  code: string;
  started_at: Date;
  ended_at: Date;
  initial_clock_ms: number;
  result: GameResult;
  player_names: Record<Seat, string>;
  events: GameEvent[];
};

function rowToRecord(r: GameRow): SavedGameRecord {
  return {
    gameId: r.game_id,
    seriesId: r.series_id,
    seriesIndex: r.series_index,
    code: r.code,
    startedAt: r.started_at.getTime(),
    endedAt: r.ended_at.getTime(),
    initialClockMs: r.initial_clock_ms,
    result: r.result,
    playerNames: r.player_names,
    events: r.events,
  };
}
