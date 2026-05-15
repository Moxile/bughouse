CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username             citext UNIQUE NOT NULL,
  email                citext UNIQUE,
  email_verified_at    timestamptz,
  password_hash        text,
  display_name         text NOT NULL,
  rating               int NOT NULL DEFAULT 1200,
  rating_games_played  int NOT NULL DEFAULT 0,
  failed_login_count   smallint NOT NULL DEFAULT 0,
  locked_until         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_rating ON users(rating DESC);

CREATE TABLE sessions (
  token_hash    bytea PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  user_agent    text,
  ip            inet
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE games (
  game_id          uuid PRIMARY KEY,
  series_id        uuid NOT NULL,
  series_index     int NOT NULL,
  code             text NOT NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz NOT NULL,
  initial_clock_ms int NOT NULL,
  result           jsonb NOT NULL,
  player_names     jsonb NOT NULL,
  events           jsonb NOT NULL,
  rated            boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_games_series ON games(series_id, series_index);
CREATE INDEX idx_games_code ON games(code);
CREATE INDEX idx_games_started_at ON games(started_at DESC);

CREATE TABLE game_seats (
  game_id  uuid NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  seat     smallint NOT NULL CHECK (seat BETWEEN 0 AND 3),
  user_id  uuid REFERENCES users(id),
  PRIMARY KEY (game_id, seat)
);
CREATE INDEX idx_game_seats_user ON game_seats(user_id);

CREATE TABLE rating_history (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users(id),
  game_id           uuid NOT NULL REFERENCES games(game_id),
  seat              smallint NOT NULL CHECK (seat BETWEEN 0 AND 3),
  rating_before     int NOT NULL,
  rating_after      int NOT NULL,
  delta             int NOT NULL,
  opponent_team_avg int NOT NULL,
  k_factor          smallint NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rating_history_user ON rating_history(user_id, created_at DESC);
