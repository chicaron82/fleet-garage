-- A HUMAN PIN OUTRANKS A TAG READ.
--
-- Aaron, 2026-08-25: "what do you think of FG just mapping CRHX to E6 despite what the tag says.
-- saves me from constantly changing it."
--
-- He was fighting a loop he could not win. `api/keytag-read.ts` upserts this table on EVERY scan
-- where the tag prints both a class code and a rental class -- unconditional, last-write-wins,
-- under the comment "Ground truth only -- the tags are the chart". So every CRHX scan whose tag
-- reads Q4 re-taught Q4 and erased his correction; the row's updated_at was 2026-08-26 00:04Z,
-- mid-shift, and the 5 live CRHX cars sat split 2 E6 / 3 Q4 with every one touched inside 48h.
--
-- The tag IS the artifact for what the tag knows -- plate, unit, VIN, class code. It is NOT an
-- oracle for the rental class: the printed class is whatever was assigned when the tag was
-- printed, and for the hybrid RAV4s that is stale.
--
-- pinned_at NOT NULL = a person decided this; the scan may read it but must never overwrite it.
-- NULL = keep learning from tags exactly as before. Nothing about existing behaviour changes for
-- the 74 unpinned codes.
alter table public.class_code_rental_class
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid;

comment on column public.class_code_rental_class.pinned_at is
  'Set when a person fixed this mapping by hand. While set, a key-tag scan may READ this row but must never upsert over it -- see api/keytag-read.ts. NULL = still learning from tags.';
comment on column public.class_code_rental_class.pinned_by is
  'Who pinned it (auth uid). NULL on the seeded pin below, which came from the printed Hertz chart rather than an in-app action.';

-- The one he named, and the one FG has documented since 2026-07-22 in
-- api/_lib/vehicleClassCodex.ts: "the real class is E6 (powertrain-hybrid group, per the Hertz
-- chart he photographed 2026-07-20)." The codex already marks CRHX isHybrid, and CLASS_LABELS
-- already reads E6 = "Hybrid" -- the class table was the only half disagreeing.
-- pinned_by stays NULL: this came off the chart, not from a tap, and saying so is more honest
-- than attributing it to whoever happened to scan last.
insert into public.class_code_rental_class (code, rental_class, pinned_at, pinned_by, updated_at)
values ('CRHX', 'E6', now(), null, now())
on conflict (code) do update
  set rental_class = excluded.rental_class,
      pinned_at    = excluded.pinned_at,
      pinned_by    = excluded.pinned_by,
      updated_at   = excluded.updated_at;
