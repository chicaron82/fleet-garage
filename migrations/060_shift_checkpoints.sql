-- Migration: 060_shift_checkpoints
-- Captures the gas sheet page count at closing crew arrival.
-- Used to calculate closing's car count from arrival, not from handoff.
-- One row per branch per day per checkpoint_type (unique constraint).

CREATE TABLE shift_checkpoints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         TEXT        NOT NULL DEFAULT 'YWG',
  date              DATE        NOT NULL,
  checkpoint_type   TEXT        NOT NULL DEFAULT 'closing_arrival',
  full_pages        INTEGER     NOT NULL DEFAULT 0,
  last_page_entries INTEGER     NOT NULL DEFAULT 0,
  logged_by         TEXT        NOT NULL,
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_checkpoint_branch_date_type
    UNIQUE (branch_id, date, checkpoint_type)
);

CREATE INDEX idx_checkpoint_branch_date
  ON shift_checkpoints(branch_id, date);

-- RLS — blanket open policy, consistent with migrations 017 and 044
ALTER TABLE shift_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_checkpoints_open" ON shift_checkpoints
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shift_checkpoints;
