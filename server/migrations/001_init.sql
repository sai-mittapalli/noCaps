-- noCaps Phase 6 — Initial schema
-- Run this in your Supabase SQL editor (or any PostgreSQL instance)

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  password_hash TEXT      NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('host', 'viewer')),
  display_name TEXT       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        UNIQUE NOT NULL,
  title       TEXT        NOT NULL,
  team_a      TEXT        NOT NULL,
  team_b      TEXT        NOT NULL,
  sport       TEXT        NOT NULL DEFAULT '',
  venue       TEXT        NOT NULL DEFAULT '',
  host_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  is_live     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_code_idx       ON matches (code);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches (created_at DESC);
