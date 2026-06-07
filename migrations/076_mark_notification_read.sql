-- 076_mark_notification_read.sql
-- Atomic, idempotent DB-side append for notification read state.
-- Replaces the client-side read-modify-write (read_by: [...n.read_by, userId])
-- which races when two users (or two devices) mark the same row simultaneously.
--
-- array_append runs server-side against the current column value, so concurrent
-- callers each append to the live array rather than clobbering each other.
-- The WHERE NOT (read_by @> ARRAY[p_user_id]) makes it a no-op on double-tap.

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid, p_user_id text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE notifications
  SET read_by = array_append(read_by, p_user_id)
  WHERE id = p_notification_id
    AND NOT (read_by @> ARRAY[p_user_id]);
$$;
