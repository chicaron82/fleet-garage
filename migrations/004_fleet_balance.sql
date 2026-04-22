-- Fleet Balance Entry Table
-- Stores daily OUT/IN fleet numbers logged by management or Lead VSA

CREATE TABLE fleet_balance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,  -- one entry per day
  out_count   INTEGER NOT NULL,
  in_count    INTEGER NOT NULL,
  entered_by  UUID NOT NULL,         -- User.id (from USERS mock, not Supabase auth)
  entered_at  TIMESTAMPTZ DEFAULT now()
);

-- Index on date for fast lookups
CREATE INDEX idx_fleet_balance_date ON fleet_balance(date DESC);

-- Comment for context
COMMENT ON TABLE fleet_balance IS 'Daily OUT/IN fleet numbers logged by management or Lead VSA. One row per calendar date. The absence of data is itself meaningful.';
