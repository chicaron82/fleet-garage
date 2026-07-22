-- How many keys are on the ring. A new Carnival ships with 4; a modern smart key is a few
-- hundred dollars to cut and program, so a car coming back 4→3 is a real, chargeable loss —
-- but only if it's caught while the contract is still open (the check-in/flip). Storing the
-- EXPECTED count is what lets FG do the comparison instead of Aaron remembering it was four.
-- Nullable: pre-existing rows and manual registrations simply have none until first observed.
-- See docs/July/ticket-flip-key-count.md
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS key_count integer;
