-- 158 — A plate watch can be an ERRAND, not only a hold.
--
-- Aaron, 2026-10-21, with a stack of new MPI registration cards for cars still carrying expired ones: *"wanna create
-- a flag for them. To update the registration"*, shown *"When I scan/look up a vehicle. Like how geotab cars work"*.
--
-- Migration 128 built the watch for one meaning, HOLD, and the scan banner says so in red on every row. A card swap
-- at the glovebox is not a hold: the car stays rentable, and a banner shouting "HOLD THIS CAR" over it is the surface
-- lying. So the row says which it is. Every existing watch was a hold (DFDA712), hence the default.
-- Ticket: docs/ticket-plate-watch-errand-kind.md.
alter table public.plate_watches
  add column if not exists kind text not null default 'hold';

alter table public.plate_watches drop constraint if exists plate_watches_kind_check;
alter table public.plate_watches
  add constraint plate_watches_kind_check check (kind in ('hold', 'errand'));

comment on column public.plate_watches.kind is
  'hold = stop the car (red, HOLD THIS CAR). errand = something to do at the car, which stays rentable (amber note).';
