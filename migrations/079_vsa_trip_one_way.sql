-- Migration 079: one-way movement-log trips (airport flipping).
--
-- The movement log assumed round trips — depart, return, "✓ Back at Washbay".
-- Airport flipping is one-way: you drive out, stay there flipping cars, and any
-- return is logged as a separate trip. one_way records that end-state so history
-- can distinguish a completed-without-return run from a round trip.
--
-- It can't be derived from a null queue_at_arrival: that field is already
-- optional on round trips, so null is ambiguous. Explicit column it is. Existing
-- rows default to false (round trip), matching today's behaviour. Forward-only.

ALTER TABLE vsa_trips
  ADD COLUMN IF NOT EXISTS one_way boolean DEFAULT false NOT NULL;
