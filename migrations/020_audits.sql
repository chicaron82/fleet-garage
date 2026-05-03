-- Migration: 020-audits
-- Run in Supabase SQL Editor
-- Persists completed audits for the live dashboard view.
-- Audits are naturally scoped to a day via the date column (no scheduled cleanup needed).
-- crew + sections stored as JSONB to avoid normalizing a deeply nested structure (PoC-appropriate).

CREATE TABLE audits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      TEXT        NOT NULL,
  date           DATE        NOT NULL,                    -- date of audit (for day-scoped queries)
  auditor_id     TEXT        NOT NULL,                   -- User.id
  auditor_name   TEXT        NOT NULL,
  vehicle_number TEXT        NOT NULL,
  plate          TEXT        NOT NULL,
  owning_area    TEXT        NOT NULL,
  crew           JSONB       NOT NULL,                   -- AuditCrewMember[]
  sections       JSONB       NOT NULL,                   -- AuditSection[]
  status         TEXT        NOT NULL CHECK (status IN ('PASSED', 'FAILED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by branch + date (live dashboard query)
CREATE INDEX idx_audits_branch_date ON audits(branch_id, date);

-- Fast lookups by auditor + date
CREATE INDEX idx_audits_auditor_date ON audits(auditor_id, date);
