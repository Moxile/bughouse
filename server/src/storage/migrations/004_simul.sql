-- Add simul_teams to games table for replay/history display.
ALTER TABLE games ADD COLUMN simul_teams jsonb NOT NULL DEFAULT '{"0":false,"1":false}'::jsonb;

-- Add pool column to rating_history to distinguish normal vs simul rating pools.
ALTER TABLE rating_history ADD COLUMN pool text NOT NULL DEFAULT 'normal';

-- Add simul rating fields to users.
ALTER TABLE users ADD COLUMN simul_rating int NOT NULL DEFAULT 1200;
ALTER TABLE users ADD COLUMN simul_rating_games_played int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_simul_rating ON users(simul_rating DESC);
