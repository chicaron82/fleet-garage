-- Normalize queue_at_departure values in vsa_trips.
--
-- Two categories of bad data:
--
--   1. Resumed trips that stored a JSON object { count: 0, label: "Resumed" }
--      instead of NULL. These represent no real queue reading — set to NULL.
--
--   2. Legacy string value "TOO_MUCH" from the original QueueSnapshot type.
--      The value was later renamed to "10+" for display consistency. Normalize
--      all remaining occurrences to "10+".
--
-- After this migration, the only valid non-null values are: '0', '~5', '10+'

-- Fix resumed trip objects (stored as JSONB or JSON-cast text)
UPDATE vsa_trips
SET queue_at_departure = NULL
WHERE queue_at_departure::text LIKE '%Resumed%';

-- Normalize TOO_MUCH → 10+ (plain text and JSON-quoted variants)
UPDATE vsa_trips
SET queue_at_departure = '"10+"'
WHERE queue_at_departure::text IN ('"TOO_MUCH"', 'TOO_MUCH');
