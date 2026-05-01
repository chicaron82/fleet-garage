-- Shift handoff notes
-- Logged at the end of each shift to brief the incoming team.

create table if not exists handoff_notes (
  id               uuid primary key default gen_random_uuid(),
  branch_id        text not null,
  logged_by        text not null,
  logged_by_name   text not null,
  logged_at        timestamptz not null default now(),
  dirties_in_queue int not null default 0,
  cleans_at_airport int not null default 0,
  lot_status       text not null default 'manageable', -- 'zeroed' | 'manageable' | 'backlog'
  expected_returns text,
  notes            text
);

create index if not exists handoff_notes_branch_id_logged_at_idx
  on handoff_notes (branch_id, logged_at desc);
