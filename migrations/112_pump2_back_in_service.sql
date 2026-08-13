-- Pump 2 is back in service (2026-08-13). It was locked out and tracked as a
-- single tripwire reading (pump2_reading, expected to never move from 1439). It
-- got used again during Aaron's vacation, so it's returning to normal service and
-- is now tracked like Pump 1: an opening + closing analog gauge → litres pumped.
--
-- Additive + idempotent: add pump2_open / pump2_close. The legacy pump2_reading
-- column is LEFT IN PLACE (historical rows keep their tripwire value; nothing is
-- dropped, no data loss). New rows write open/close; the app stops reading the
-- locked baseline. shift_summaries.pump2_drift is likewise left alone — it simply
-- stops receiving new values (old anomaly rows stay readable).
ALTER TABLE fuel_pump_readings
  ADD COLUMN IF NOT EXISTS pump2_open  INTEGER,
  ADD COLUMN IF NOT EXISTS pump2_close INTEGER;
