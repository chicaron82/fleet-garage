CREATE TABLE inventory_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     TEXT NOT NULL,
  session_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_data    JSONB NOT NULL DEFAULT '[]'::jsonb,
  exported_at   TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_inventory_sessions_branch_date
  ON inventory_sessions(branch_id, session_date);
