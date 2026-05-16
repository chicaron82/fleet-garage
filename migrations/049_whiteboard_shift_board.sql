-- Add shift_board section to whiteboard_notes
ALTER TABLE whiteboard_notes
  DROP CONSTRAINT IF EXISTS whiteboard_notes_section_check;

ALTER TABLE whiteboard_notes
  ADD CONSTRAINT whiteboard_notes_section_check
    CHECK (section IN ('reminders', 'downtime', 'airport', 'shift_board'));
