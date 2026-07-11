-- 096: Cross-device continuity for Effie's chat thread (docs/ticket-effie-thread-cross-device.md).
-- The visible thread was localStorage-only (scoped per-device AND per-origin), so phone / deployed
-- site / dev server each carried a SEPARATE conversation. This makes the thread follow the USER:
-- the server is the shared source of truth, localStorage stays the instant/offline fast-path cache
-- (mirrors user_preferences, migration 015). One row per user holding the packed {at, messages}
-- wrapper — text turns only, capped to 40, 12h TTL — the exact shape effieThread already stores.
-- Sequential handoff: a device loads the latest on open (server wins on hydration). RLS allow-all
-- (FG trusted-crew, [[project_fg_scope_boundary]]).
create table if not exists public.effie_threads (
  user_id     text primary key,
  thread      jsonb not null,     -- packed { at: epoch_ms, messages: [{role, text}] }
  updated_at  timestamptz not null default now()
);

comment on table public.effie_threads is
  'Per-user Effie chat thread for cross-device continuity (sequential handoff). Server = shared source of truth; localStorage = fast-path/offline cache. Text turns only, capped + 12h TTL enforced client-side (src/lib/effieThread + effieThreadSync). See docs/ticket-effie-thread-cross-device.md.';

alter table public.effie_threads enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'effie_threads' and policyname = 'effie_threads_all'
  ) then
    create policy effie_threads_all on public.effie_threads for all using (true) with check (true);
  end if;
end $$;
