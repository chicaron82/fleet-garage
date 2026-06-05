-- EDV no-match structured fields: plate + exterior/interior condition.
-- Previously VSAs typed "LUR249 - extremely muddy exterior" into notes (free text).
-- These columns make the plate queryable and conditions aggregatable across shifts.
-- Only populated for edvNoMatch entries (auto-link EDV already has unit + hold).

ALTER TABLE off_standard_entries
  ADD COLUMN IF NOT EXISTS edv_plate     text;
ALTER TABLE off_standard_entries
  ADD COLUMN IF NOT EXISTS edv_exterior  boolean NOT NULL DEFAULT false;
ALTER TABLE off_standard_entries
  ADD COLUMN IF NOT EXISTS edv_interior  boolean NOT NULL DEFAULT false;
