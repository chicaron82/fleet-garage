-- 088: Effie's durable per-operator memory (#2) — a curated store of standing
-- facts the operator explicitly asks Effie to remember. Each fact is confirm-gated
-- (drafted like a hold/lost-item, written only on the operator's tap) and injected
-- into Effie's chat context each turn so she personalizes to the operator. This is
-- the "Effie knows you" store, distinct from thread continuity (#1, localStorage).
-- Idempotent. RLS allow-all — FG trusted-crew posture, by design.
create table if not exists public.effie_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

comment on table public.effie_memory is
  'Durable per-operator facts the assistant (Effie) recalls — the operator confirms each one (like a hold), and they are injected into the chat context. See api/fg-chat.ts + src/hooks/useEffieMemory.';

alter table public.effie_memory enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'effie_memory' and policyname = 'effie_memory_all'
  ) then
    create policy effie_memory_all on public.effie_memory for all using (true) with check (true);
  end if;
end $$;

create index if not exists effie_memory_user_idx on public.effie_memory (user_id, created_at desc);
