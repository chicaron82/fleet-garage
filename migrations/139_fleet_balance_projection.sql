-- Persist the estimate that was SHOWN, alongside the balance that was entered.
--
-- ⭐ THE ARGUMENT IS NOT CONVENIENCE, IT IS INDEPENDENCE. Aaron asked (2026-09-08): "do past
-- estimates get stored? are it's estimates getting better? is there a way to compare the estimate
-- vs what got entered". The answer was no, no, and "not in the app — but recoverable", because
-- getProjection() is a pure function of prior entries and can be replayed.
--
-- ⚠️ THAT RECOVERABILITY DIES THE MOMENT THE FORMULA CHANGES. Replay only reconstructs history
-- while the code that made it still exists. So the record has to stop depending on the code — and
-- the backfill has to run BEFORE the window change, or those 78 days are gone for good.
--
-- projected_basis records WHICH rule produced the number (same-weekday / prior-7 / weekday
-- fallback, and the n behind it), because an estimate you cannot attribute to a rule cannot tell
-- you which rule to fix.
alter table fleet_balance
  add column if not exists projected_out   integer,
  add column if not exists projected_in    integer,
  add column if not exists projected_basis text;

comment on column fleet_balance.projected_out is
  'What the card estimated for OUT before this day was entered. Null = no estimate was available (too little history).';
comment on column fleet_balance.projected_in is
  'What the card estimated for IN before this day was entered.';
comment on column fleet_balance.projected_basis is
  'Which rule produced it — e.g. "same-weekday n=10", "prior-7", "weekday-fallback n=54". Backfilled rows are stamped "backfill:" so a replayed estimate is never mistaken for one actually shown.';
