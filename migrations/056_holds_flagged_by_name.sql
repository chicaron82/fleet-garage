-- 056_holds_flagged_by_name.sql
-- holds.flagged_by_id stores the Supabase auth UUID, but the display layer was
-- resolving names via the USERS mock (which uses mock IDs like 'u1'). Real UUIDs
-- never match, so every hold showed "Flagged by Unknown". Denormalize name and
-- employee ID at write time so attribution is always readable.

ALTER TABLE holds ADD COLUMN IF NOT EXISTS flagged_by_name        text NOT NULL DEFAULT '';
ALTER TABLE holds ADD COLUMN IF NOT EXISTS flagged_by_employee_id text NOT NULL DEFAULT '';
