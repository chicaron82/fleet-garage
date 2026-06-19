-- Fuel pump readings — digitising the paper gas pump card. One row per shift's
-- close-out: two analog gauges (Pump 1 metered, Pump 2 the loss-prevention
-- tripwire) and the digital tank reading.
--
-- Pump 2 is the point: that side was taken out of service and its gauge should
-- never move from its last value (baseline 1439). The "last recorded" reading is
-- the most recent row's pump2_reading for the branch — read back next shift so a
-- drift (the 1439 → 1201 side-use incident) surfaces as a warning the moment a
-- different number is typed. Analog readings are whole numbers; the digital tank
-- is a real instrument, so it keeps decimals.
CREATE TABLE IF NOT EXISTS fuel_pump_readings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      TEXT        NOT NULL,
  date           DATE        NOT NULL,
  pump1_open     INTEGER,
  pump1_close    INTEGER,
  pump2_reading  INTEGER,
  digital_open   NUMERIC,
  digital_close  NUMERIC,
  topup_note     TEXT,
  logged_by_id   TEXT,
  logged_by_name TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Last recorded Pump 2 for this branch" — the read every shift's entry does.
CREATE INDEX IF NOT EXISTS idx_fuel_pump_readings_branch_recent
  ON fuel_pump_readings (branch_id, created_at DESC);
