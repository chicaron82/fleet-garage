-- Migration 006: Live notification system
-- Zee ticket, Apr 28 2026

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  branch_id       text not null,
  recipient_roles text[] not null,
  icon            text not null,
  text            text not null,
  severity        text not null default 'info',
  is_read         boolean not null default false,
  read_by         text[] not null default '{}',
  created_at      timestamptz not null default now(),
  metadata        jsonb
);

-- RLS: authenticated users can read and insert
alter table notifications enable row level security;

create policy "Authenticated users can read notifications"
  on notifications for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert notifications"
  on notifications for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update read_by"
  on notifications for update
  using (auth.role() = 'authenticated');

-- Index for fast role + branch queries
create index notifications_branch_id_idx on notifications (branch_id);
create index notifications_created_at_idx on notifications (created_at desc);
