-- EDV dual documentation: preset reasons + hold linkage

alter table off_standard_entries
  add column if not exists preset_reason  text,
  add column if not exists linked_hold_id text references holds(id);

alter table holds
  add column if not exists offstandard_linked         boolean   default false,
  add column if not exists cleaned_inhouse_logged_at  timestamptz;
