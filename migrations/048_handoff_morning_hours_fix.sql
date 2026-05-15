ALTER TABLE handoff_notes
  ALTER COLUMN morning_hours SET DEFAULT 8.0;

UPDATE handoff_notes SET morning_hours = 8.0 WHERE morning_hours = 8.5;
