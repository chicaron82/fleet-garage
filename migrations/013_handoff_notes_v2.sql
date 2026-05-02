-- Migration 013: Handoff notes v2 — gas sheet pages replace dirties/cleans/expected_returns
-- Outgoing shift logs what they cleaned (full_pages + last_page_entries → cars cleaned this shift)
-- Enables opener vs. closer throughput comparison over time

alter table handoff_notes
  add column if not exists full_pages        integer not null default 0,
  add column if not exists last_page_entries integer not null default 0;

alter table handoff_notes
  drop column if exists dirties_in_queue,
  drop column if exists cleans_at_airport,
  drop column if exists expected_returns;
