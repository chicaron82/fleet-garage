-- 171: Pulled away (2026-11-19, docs/ticket-lot-bay-pulled-away.md). Aaron: *"I got pulled for almost an hour to go pick
-- up vehicles at various locations and during that time the count went stale"*, then *"What about a generic pause when
-- pulled. Could be driving. Maybe a meeting or doing something else"*.
-- Which kind of pause break_at (migration 166) is: 'break', or 'pulled' (off the bay on other work). It only means
-- something while break_at holds. Defaults to 'break', so every pause before this reads as the break it was. Additive.
alter table public.lot_bay add column if not exists break_kind text not null default 'break'
  check (break_kind in ('break', 'pulled'));
comment on column public.lot_bay.break_kind is
  'Which pause break_at is: break (On break) or pulled (Pulled away, on other work). The read-only page words its heads-up by it, with no time and no reason.';
