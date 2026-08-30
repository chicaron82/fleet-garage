-- 132 — the change log can finally say WHO.
--
-- `VehicleChangeLog`'s own header has said this since it shipped:
--
--   ⚠️ It never says WHO. FG writes with the anon key under allow-all RLS, so no honest actor
--   exists to name. Better a trail that admits what it doesn't know than one that quietly implies
--   a person.
--
-- True, and avoidable. Two sources of truth about the caller already exist and neither needs a
-- client change:
--
--   1. PostgREST publishes the caller's JWT as `request.jwt.claims` on EVERY request, so the
--      trigger can read `sub` — the signed-in user — for free. Every tap in FG becomes attributed
--      with no code touched.
--   2. `app.actor`, a session GUC, for writes arriving from outside the app. DiZee's
--      Management-API SQL sets it in the same transaction, so those say `dizee` rather than
--      guessing.
--
-- ⚠️ NULL STAYS A REAL ANSWER. A backfill script, a psql session, or a future writer that sets
-- neither records NOTHING rather than inheriting whoever happened to be signed in. That is the
-- whole point of the original header: a trail which quietly implies a person is worse than one
-- that admits it does not know. Historic rows keep null — nothing is retro-attributed.
--
-- Aaron, 2026-08-30, on whether a DiZee write should be marked as FG/Effie: *"effie uses the same
-- models are you and FG runs off code that you cooked to be able to read."* He is right, and that
-- settles PROVENANCE — `tag` already means "a model read this, not a person", so Effie reading a
-- key tag and DiZee reading one are the same act and need no new tier. What was missing was never
-- a tier. It was an ACTOR.

alter table public.vehicle_changes
  add column if not exists actor text;

comment on column public.vehicle_changes.actor is
  'Who caused this change: the signed-in user id (from the JWT), a named non-app writer via the app.actor GUC (e.g. ''dizee''), or NULL when genuinely unknown. NULL is honest and must never be filled with a guess.';

create or replace function public.log_vehicle_change()
 returns trigger
 language plpgsql
as $function$
DECLARE
  old_j JSONB;
  new_j JSONB;
  diff  JSONB := '{}'::jsonb;
  k     TEXT;
  who   TEXT;
BEGIN
  -- ⚠️ Order matters: an explicit `app.actor` wins over the JWT, because a non-app writer that
  -- bothered to name itself is more specific than whatever session it borrowed. Both missing → NULL.
  who := coalesce(
    nullif(current_setting('app.actor', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  );

  IF TG_OP = 'DELETE' THEN
    INSERT INTO vehicle_changes (vehicle_id, op, changed, actor) VALUES (OLD.id, 'DELETE', to_jsonb(OLD), who);
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
    INSERT INTO vehicle_changes (vehicle_id, op, changed, actor) VALUES (NEW.id, 'UPDATE', diff, who);
  END IF;

  RETURN NEW;
END;
$function$;
