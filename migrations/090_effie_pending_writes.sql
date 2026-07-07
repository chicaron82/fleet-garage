-- 090: Effie's pending-writes queue. Her INFERRED writes (a register drafted from a
-- keytag, a backfill, a log) can be STAGED here — "log and go" — instead of demanding a
-- synchronous confirm-card tap. The operator reviews the queue when free and approves
-- (runs the real write via the same dispatch as the confirm card, useProposalConfirm) or
-- rejects. Provenance on every row (who proposed / from where / when / who resolved) so an
-- approved change is traceable — recall→knowing, applied to the data itself.
--
-- Write-type-agnostic on purpose: `kind` is the Proposal.kind and `proposal` is the full
-- serialized Proposal (jsonb), dispatched by kind on approval. Do NOT special-case a kind
-- here — every future producer (keytag scan, inventory sheet, voice, proactive suggestions)
-- merges onto this one lane. See docs/ticket-misc-effie-pending-writes.md.
--
-- Idempotent. RLS allow-all — FG trusted-crew posture, by design.
create table if not exists public.effie_pending_writes (
  id           uuid primary key default gen_random_uuid(),
  proposed_by  uuid not null references public.profiles(id) on delete cascade,
  kind         text not null,                       -- Proposal.kind (register_vehicle, hold, lost_item, ...)
  proposal     jsonb not null,                      -- the full serialized Proposal, dispatched on approve
  source       text not null default 'effie-chat',  -- where it was staged (effie-chat, keytag-scan, ...)
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  resolved_by  uuid references public.profiles(id),
  resolved_at  timestamptz
);

comment on table public.effie_pending_writes is
  'Staged (not-yet-written) proposals Effie inferred — the operator approves (runs the real write) or rejects each in the pending queue. Write-type-agnostic: kind + serialized proposal jsonb. See src/hooks/usePendingWrites + docs/ticket-misc-effie-pending-writes.md.';

alter table public.effie_pending_writes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'effie_pending_writes' and policyname = 'effie_pending_writes_all'
  ) then
    create policy effie_pending_writes_all on public.effie_pending_writes for all using (true) with check (true);
  end if;
end $$;

create index if not exists effie_pending_writes_queue_idx
  on public.effie_pending_writes (proposed_by, status, created_at desc);
