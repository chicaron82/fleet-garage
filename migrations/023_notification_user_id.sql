-- Personal notification targeting
-- Allows notifications to be directed at a specific user rather than a role broadcast.
-- When set, only that user sees the notification regardless of recipient_roles.

alter table notifications
  add column if not exists recipient_user_id text;
