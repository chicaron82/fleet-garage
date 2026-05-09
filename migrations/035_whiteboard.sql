CREATE TABLE IF NOT EXISTS whiteboard_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT        NOT NULL,
  section         TEXT        NOT NULL CHECK (section IN ('reminders', 'downtime', 'airport')),
  body            TEXT        NOT NULL,
  author_id       TEXT        NOT NULL,
  author_name     TEXT        NOT NULL DEFAULT '',
  author_role     TEXT        NOT NULL DEFAULT '',
  trigger_type    TEXT        NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual', 'seasonal', 'calendar_month')),
  active_months   INTEGER[],
  status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at     TIMESTAMPTZ,
  archived_by_id  TEXT
);

CREATE INDEX idx_whiteboard_branch_section
  ON whiteboard_notes(branch_id, section, status);

-- Seed: airport extension (permanent, manual)
INSERT INTO whiteboard_notes (branch_id, section, body, author_id, author_name, author_role, trigger_type, status)
VALUES ('YWG', 'airport', 'Counter extension: 623-625', 'system', 'System', 'System', 'manual', 'active');

-- Seed: winter seasonal reminder (surfaces when peak season is off)
INSERT INTO whiteboard_notes (branch_id, section, body, author_id, author_name, author_role, trigger_type, status)
VALUES ('YWG', 'reminders', 'SEND W/T CARS AIRPORT ASAP', 'system', 'Geoff N.', 'Lead VSA', 'seasonal', 'active');
