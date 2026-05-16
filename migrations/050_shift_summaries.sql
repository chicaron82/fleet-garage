CREATE TABLE IF NOT EXISTS shift_summaries (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT        NOT NULL,
  user_name                TEXT        NOT NULL,
  branch_id                TEXT        NOT NULL,
  date                     DATE        NOT NULL,
  first_activity_at        TIMESTAMPTZ,
  saved_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  off_standard_minutes     INTEGER     NOT NULL DEFAULT 0,
  off_standard_breakdown   JSONB,
  trip_count               INTEGER     NOT NULL DEFAULT 0,
  trip_minutes             INTEGER     NOT NULL DEFAULT 0,
  holds_flagged            INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_shift_summaries_branch_date
  ON shift_summaries (branch_id, date);
