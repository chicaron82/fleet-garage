-- Store a vehicle's RENTAL CLASS — the boss's size/type group shorthand (Q4, P4, T, L2…)
-- read straight off the keytag's top corner. Distinct from the 4-char class code: it's the
-- language the boss uses to request returns ("send me the Q4s"), so storing it lets FG answer
-- that list. Nullable — manual registrations and pre-existing rows simply have none.
-- See docs/July/ticket-optical-capture-rental-class.md (step 2).
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_class text;
