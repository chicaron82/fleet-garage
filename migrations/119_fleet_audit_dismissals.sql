-- Settled findings for the fleet audit (2026-08-19).
--
-- The audit reports contradictions FG can already see — a unit number on two live records, a plate
-- on two, two plates one misread apart. Some of those are REAL and will never stop being true: unit
-- 5427497 carries a Green Prius and a Gray Prius, which may be two genuine cars with one bad unit
-- number that nobody can correct from here.
--
-- ⭐ WHY THIS TABLE EXISTS AT ALL: an audit list you cannot clear is a list you stop reading. The
-- same failure as a badge that is always red — after the third time past an item he can't action,
-- the whole surface becomes wallpaper and the NEXT finding, the real one, arrives invisible. So a
-- finding has to be dismissible, and the dismissal has to outlive the session.
--
-- Keyed on the finding's own stable key (`duplicate-unit:5427497`), not on row ids — the key is
-- derived from the identifiers themselves, so re-registering a car cannot resurrect something he
-- already settled, and a dismissal survives the records being edited around it.

CREATE TABLE IF NOT EXISTS fleet_audit_dismissals (
  finding_key   TEXT PRIMARY KEY,
  branch_id     TEXT,
  dismissed_by  TEXT,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT
);

-- FG's standard posture: RLS on with an allow-all policy (trusted-crew PoC, anon key in the client
-- by design). Posture alignment and advisory silencing, not a lockdown.
ALTER TABLE fleet_audit_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fleet_audit_dismissals_all ON fleet_audit_dismissals;
CREATE POLICY fleet_audit_dismissals_all ON fleet_audit_dismissals
  FOR ALL TO public USING (true) WITH CHECK (true);
