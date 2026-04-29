-- Migration 004: PTO entitlement per user
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_pto (
  user_id          TEXT PRIMARY KEY,
  pto_entitlement  INT  NOT NULL DEFAULT 15,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing users with default 15 days (adjust manually as needed)
-- INSERT INTO user_pto (user_id, pto_entitlement) VALUES ('user-id-here', 15);
