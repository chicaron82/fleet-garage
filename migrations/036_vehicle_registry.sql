-- Per-visit lifecycle tracking — built progressively through normal operations
CREATE TABLE IF NOT EXISTS vehicle_registry (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       TEXT        NOT NULL,
  vehicle_id      TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  plate           TEXT,
  unit_number     TEXT,
  make            TEXT,
  model           TEXT,
  year            INTEGER,
  color           TEXT,
  arrived_at      TIMESTAMPTZ,
  cleaned_at      TIMESTAMPTZ,
  dispatched_at   TIMESTAMPTZ,
  needs_review    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date            DATE        NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_vehicle_registry_branch_date ON vehicle_registry(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_vehicle_registry_plate       ON vehicle_registry(plate);
CREATE INDEX IF NOT EXISTS idx_vehicle_registry_unit        ON vehicle_registry(unit_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_registry_vehicle_id  ON vehicle_registry(vehicle_id);

ALTER TABLE vehicle_registry ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_registry' AND policyname = 'Allow all access') THEN
    CREATE POLICY "Allow all access" ON vehicle_registry FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Permanent plate ↔ unit pairings — written once, used forever
CREATE TABLE IF NOT EXISTS vehicle_identifiers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plate        TEXT        NOT NULL,
  unit_number  TEXT        NOT NULL,
  confirmed    BOOLEAN     NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  UNIQUE(plate, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_identifiers_plate ON vehicle_identifiers(plate);
CREATE INDEX IF NOT EXISTS idx_identifiers_unit  ON vehicle_identifiers(unit_number);

ALTER TABLE vehicle_identifiers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_identifiers' AND policyname = 'Allow all access') THEN
    CREATE POLICY "Allow all access" ON vehicle_identifiers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
