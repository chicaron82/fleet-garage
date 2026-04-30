-- Migration 008: Live notification system
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

-- RLS: anon role (app uses anon key — no Supabase Auth)
alter table notifications enable row level security;

create policy "read"   on notifications for select to anon using (true);
create policy "insert" on notifications for insert to anon with check (true);
create policy "update" on notifications for update to anon using (true);

-- Index for fast role + branch queries
create index notifications_branch_id_idx on notifications (branch_id);
create index notifications_created_at_idx on notifications (created_at desc);
