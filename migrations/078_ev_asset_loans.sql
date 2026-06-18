-- EV asset loans — a structured cross-vehicle link replacing the free-text
-- "adapter lent to unit 5424…" note. One row per lent asset (cable OR adapter),
-- open until returned. The borrower is stored as a TEXT unit#, matched to a
-- vehicle by unit_number AT READ TIME — so a lend to a not-yet-registered unit
-- records fine and links the moment that unit registers.
CREATE TABLE IF NOT EXISTS ev_asset_loans (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_vehicle_id  TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  asset_type         TEXT        NOT NULL CHECK (asset_type IN ('cable', 'adapter')),
  borrower_unit      TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'out' CHECK (status IN ('out', 'returned')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         TEXT,
  returned_at        TIMESTAMPTZ,
  returned_by        TEXT
);

-- Lender lookup ("what of mine is out?") — only open loans matter.
CREATE INDEX IF NOT EXISTS idx_ev_asset_loans_lender_open
  ON ev_asset_loans (lender_vehicle_id) WHERE status = 'out';

-- Borrower lookup ("am I holding someone's asset?") — resolved by unit# at read.
CREATE INDEX IF NOT EXISTS idx_ev_asset_loans_borrower_open
  ON ev_asset_loans (borrower_unit) WHERE status = 'out';
