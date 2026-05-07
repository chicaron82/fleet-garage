-- Migration 030: EV Asset Chain of Custody
-- Adds ev_cable_status + ev_adapter_status to trip and check-in records.
-- NULL = not a Tesla or skipped. 'present'/'missing' = confirmed state.

ALTER TABLE vsa_trips
  ADD COLUMN IF NOT EXISTS ev_cable_status   TEXT CHECK (ev_cable_status   IN ('present', 'missing')),
  ADD COLUMN IF NOT EXISTS ev_adapter_status TEXT CHECK (ev_adapter_status IN ('present', 'missing'));

ALTER TABLE vehicle_checkins
  ADD COLUMN IF NOT EXISTS ev_cable_status   TEXT CHECK (ev_cable_status   IN ('present', 'missing')),
  ADD COLUMN IF NOT EXISTS ev_adapter_status TEXT CHECK (ev_adapter_status IN ('present', 'missing'));
