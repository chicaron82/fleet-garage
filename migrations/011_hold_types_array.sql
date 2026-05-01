-- Migration 011_hold_types_array.sql
-- Add hold_types array column to holds table
-- Backfills existing rows by wrapping hold_type in an array

alter table holds add column if not exists hold_types text[] default null;

-- Backfill existing rows: wrap existing hold_type in array
update holds set hold_types = array[hold_type] where hold_types is null;

-- Going forward, hold_types is the source of truth
-- hold_type stays for backwards compat reads
