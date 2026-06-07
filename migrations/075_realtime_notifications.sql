-- 075_realtime_notifications.sql
-- Enable Supabase Realtime for the notifications table so the bell
-- updates live when any connected client pushes a notification, without
-- requiring a page refresh.
-- Mirrors 059_realtime_holds.sql.

alter publication supabase_realtime add table notifications;
