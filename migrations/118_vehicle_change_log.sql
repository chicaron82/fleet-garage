-- A mutation trail on vehicles (2026-08-18, greenlit by Aaron after /reflect 58 couldn't audit a
-- bad write).
--
-- WHAT PROMPTED IT: a verify stub of mine wrote invented data into a real car that morning — an
-- unread colour, stamped `field_sources: {color:'tag'}` as though a key tag had said so. I reverted
-- what I remembered touching. Hours later, auditing the blast radius properly, I found I COULDN'T:
-- `vehicles` had no `updated_at` and nothing recorded what had changed. The standing rule I wrote
-- that same morning says a verify stub must be AUDITED afterwards, not merely cleaned up
-- (feedback_verify_stubs_have_teeth) — and FG could not perform that audit. This makes the rule
-- executable.
--
-- It is also FG's own thesis pointed at FG: the app exists to replace recall with knowing. "I think
-- I only touched that one row" is exactly the kind of remembering it was built to abolish.
--
-- ⚠️ WHAT THIS DELIBERATELY DOES NOT CAPTURE: **who**. FG talks to Postgres with the anon key under
-- allow-all RLS (project_fg_scope_boundary), so `auth.uid()` is null on every write and a trigger
-- has no honest way to name an actor. Recording a guessed or defaulted user would be worse than an
-- empty column — it would be a fabricated audit trail, which is the one kind that does damage.
-- Attribution needs the client to send an identity header on every write; that is a separate cook,
-- and until it happens this table answers WHAT and WHEN, honestly, and stays silent on WHO.
--
-- Volume: ~636 vehicles and a few dozen updates a day, one narrow row per changed update. Years of
-- headroom before retention is worth a thought.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS vehicle_changes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  TEXT NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  op          TEXT NOT NULL CHECK (op IN ('UPDATE', 'DELETE')),
  changed     JSONB NOT NULL   -- UPDATE: { col: {from, to} } for changed columns only. DELETE: the whole row.
);

-- The two questions this table exists to answer: "what happened to THIS car" and "what changed in
-- THAT window" (the incident query — the one I couldn't run).
CREATE INDEX IF NOT EXISTS vehicle_changes_vehicle_idx ON vehicle_changes (vehicle_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_changes_at_idx      ON vehicle_changes (changed_at DESC);

-- FG's standard posture for every table: RLS on, allow-all policy. Posture alignment and advisory
-- silencing, not a lockdown — the anon key is in the client by design.
ALTER TABLE vehicle_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_changes_all ON vehicle_changes;
CREATE POLICY vehicle_changes_all ON vehicle_changes FOR ALL TO public USING (true) WITH CHECK (true);

-- The guarantee lives in the MECHANISM, not in a convention a caller can forget. Every writer in
-- the app — context hooks, the keytag API, a one-off script, a future me with a verify stub — is
-- logged without knowing it exists. That is the whole point: the write I most need recorded is the
-- one I didn't mean to make.
CREATE OR REPLACE FUNCTION public.log_vehicle_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_j JSONB;
  new_j JSONB;
  diff  JSONB := '{}'::jsonb;
  k     TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO vehicle_changes (vehicle_id, op, changed) VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  NEW.updated_at := now();
  old_j := to_jsonb(OLD);
  new_j := to_jsonb(NEW);

  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    -- updated_at is this trigger's own footprint; logging it would make every row look changed.
    IF k <> 'updated_at' AND (old_j -> k) IS DISTINCT FROM (new_j -> k) THEN
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', old_j -> k, 'to', new_j -> k));
    END IF;
  END LOOP;

  -- A no-op update (same values written again — FG does this constantly on upserts) writes nothing.
  -- A log full of "nothing changed" rows is a log nobody reads.
  IF diff <> '{}'::jsonb THEN
    INSERT INTO vehicle_changes (vehicle_id, op, changed) VALUES (NEW.id, 'UPDATE', diff);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_change_log ON vehicles;
CREATE TRIGGER vehicles_change_log
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_change();

-- Deletes are captured WHOLE, and separately, because a vanished row is the case where a diff has
-- nothing to diff against. FG archives rather than deletes today (archived_at), so this should stay
-- empty forever — which is exactly why it costs nothing to have.
DROP TRIGGER IF EXISTS vehicles_delete_log ON vehicles;
CREATE TRIGGER vehicles_delete_log
  AFTER DELETE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_change();
