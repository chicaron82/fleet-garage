-- Migration 014: Add team_size to handoff_notes
-- Tracks opener vs. closer team size for per-shift throughput comparison

alter table handoff_notes
  add column if not exists team_size integer not null default 3;
