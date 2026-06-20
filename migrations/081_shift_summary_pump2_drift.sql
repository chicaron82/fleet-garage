-- Add pump2_drift to shift_summaries so management can see a Pump 2 anomaly
-- in the Team Today view. Nullable: most shifts won't have fuel data logged.
-- Values mirror Pump2Status: 'ok' (unchanged), 'used' (meter advanced), 'fault' (meter dropped).
ALTER TABLE shift_summaries
  ADD COLUMN IF NOT EXISTS pump2_drift TEXT
    CHECK (pump2_drift IN ('ok', 'used', 'fault'));
