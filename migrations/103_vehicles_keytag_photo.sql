-- The key tag photo the vision read was made FROM — kept as evidence on the vehicle.
-- A read can mis-see a plate or unit, and today there's no way to check it short of finding the
-- physical car: the fields survive, the tag doesn't. Storing the photo makes every scan-created
-- record auditable — open it, see what the tag actually said, correct the field (the edit
-- affordance already exists). It's also the provenance for teaching the class codex a new code.
-- Latest tag wins: tags get reprinted when details change, so the newest read is the truth.
-- See docs/July/ticket-keytag-photo-evidence.md
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS keytag_photo_url text;
