-- 172: a note of his own on Pulled away (2026-11-25, docs/ticket-lot-bay-pulled-away-note.md). Aaron: *"adding a custom
-- note to the read-only link when I get pulled away it's serves as a little heads up"*.
-- Pulled away (171) stays generic: the APP never says what the work was. This is HIS line, optional, one short line, no
-- time. It means something only while break_at holds and break_kind is 'pulled'; Back nulls it, and the next pause of
-- either kind replaces it. lot_bay is one live row, so this is never a history. Additive.
alter table public.lot_bay add column if not exists break_note text
  check (break_note is null or char_length(break_note) <= 80);
comment on column public.lot_bay.break_note is
  'His own one-line heads-up on Pulled away, shown on the read-only page only while the pause holds. Null on a break and after Back.';
