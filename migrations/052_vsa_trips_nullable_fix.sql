-- The live vsa_trips table was created manually before the migration file
-- was written, with NOT NULL constraints on columns that need to be nullable
-- for in-progress trips. Drop the constraints so trips can be inserted
-- at departure without arrive_location, arrive_time, and vehicle_plate.

ALTER TABLE vsa_trips
  ALTER COLUMN vehicle_plate   DROP NOT NULL,
  ALTER COLUMN arrive_location DROP NOT NULL,
  ALTER COLUMN arrive_time     DROP NOT NULL;
