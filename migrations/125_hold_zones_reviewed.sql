-- "I looked, and there is nothing on the diagram to mark."
--
-- The zone-backfill queue asks one question per hold: WHICH PANEL? For a handful of holds that
-- question has no answer and never will — a rear camera lens sitting proud of its housing, a trunk
-- bed liner eaten by a chemical spill. Real faults, photographed, recorded, and located nowhere on
-- Vehicle Inspection #9000501's body diagram. `damage_zones` stays empty because it is TRUE that
-- they have no panel, so they came back to the top of the queue forever.
--
-- ⚠️ WHAT THIS COLUMN IS, AND WHAT IT IS NOT. It is NOT a fact about the car and it is NOT a
-- dismissal of the damage. Aaron settled that himself when I offered a boolean for it: "the record
-- of it already exists, just can't be shown at the 'at a glance' map. when it comes up via a scan,
-- I know that there's damage on the bed liner of that seltos." The hold is untouched — same status,
-- same notes, same photos, same everywhere-else. This records only that a HUMAN has looked at this
-- hold and answered the queue's question with "none applies".
--
-- It is queue state, not vehicle state. Which is why it is a TIMESTAMP and not a boolean: a boolean
-- would be an opinion, and a timestamp is an event that happened at a knowable moment and can be
-- audited, listed, and undone.
--
-- ⭐ WHY IT EARNS ITS KEEP, after I argued against it twice. A to-do list with permanent residents
-- is a to-do list nobody trusts. Two holds that can never be cleared turn "nothing left to tag" into
-- a lie the queue tells forever, and the number stops being read at all — which kills the feature
-- more thoroughly than any dismiss button could. Aaron, 2026-08-24: "i recognize those nothing can
-- be marked for those. i don't need FG reminding me."
--
-- The old objection was still right and is answered in the UI, not here: nothing is HIDDEN. The
-- backfill screen reports how many holds were set aside, so a real damage hold can never be quietly
-- swallowed by a tap.

alter table public.holds
  add column if not exists zones_reviewed_at timestamptz;

comment on column public.holds.zones_reviewed_at is
  'When a human looked at this hold and confirmed no body panel applies — queue state for the damage-zone backfill, NOT a fact about the vehicle and NOT a dismissal of the damage. The hold, its notes and its photos are untouched; only the "which panel?" prompt is answered. Clear it (set null) to put the hold back in the queue.';
