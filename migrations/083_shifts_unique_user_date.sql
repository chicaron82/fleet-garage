-- One shift per user per day. Multiple rows for the same user+date caused
-- silent duplicates when Fill Range ran against a date range that extended
-- beyond the view-windowed shifts state (which only covers the displayed week).
-- Belt-and-suspenders alongside the FillScheduleModal DB query fix.
ALTER TABLE shifts ADD CONSTRAINT shifts_user_date_unique UNIQUE (user_id, date);
