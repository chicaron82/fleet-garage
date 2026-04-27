-- Ensure persisted holds keep the branch they were created under.
-- Older demo rows may be missing this value; YWG is the legacy fallback used by
-- the app mapper until historical data is cleaned.

ALTER TABLE holds
  ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'YWG';

UPDATE holds
SET branch_id = 'YWG'
WHERE branch_id IS NULL;

ALTER TABLE holds
  ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holds_branch_id ON holds(branch_id);
