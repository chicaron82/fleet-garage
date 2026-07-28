-- 109_vehicle_is_hybrid.sql
-- Hybrid becomes an ATTRIBUTE (a checkbox), not a hard-coded "<Base> Hybrid" model.
-- Mirrors the existing is_tesla boolean pattern on vehicles.
-- Idempotent: ADD COLUMN IF NOT EXISTS + the fold's WHERE stops matching once models
-- no longer end in " Hybrid".

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_hybrid boolean NOT NULL DEFAULT false;

-- Fold existing hard-coded "<Base> Hybrid" rows into base model + is_hybrid = true.
-- Covers Camry/Corolla/RAV4/Sportage Hybrid (and Escape Hybrid if any exist).
-- rental_class is intentionally left untouched — class is per-vehicle, independent of the flag.
UPDATE public.vehicles
SET model     = regexp_replace(model, '\s+Hybrid$', ''),
    is_hybrid = true
WHERE model ~ '\sHybrid$';
