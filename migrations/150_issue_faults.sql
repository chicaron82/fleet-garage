-- 150 — Faults as rows: a machine can be down for more than one reason at once.
--
-- ⭐ THE ASK. Aaron, 2026-09-24, at the auto wash, hours after its rinse pipe snapped: *"there's also
-- another issue for the auto wash. The wheel brush on the passenger side isn't spinning. That one has
-- been non functional for a month now."* One record with one status could not say "two faults, one
-- fixed, one still down" — the limit written down on 2026-09-20. His go: *"i have time"*.
--
-- ⭐ THE MODEL. `facility_issues` stays the MACHINE (title, first description, severity, open/closed).
-- A fault is one thing wrong with it: what broke, a photo, when it started, who logged it, and when
-- it was cleared. The machine is open while any fault is open. `issue_events` keeps the machine's
-- open / clear / reopen history exactly as before.
--
-- ⚠️ EXPLICIT GRANTS, a month early. From 2026-10-30 a new public table needs them or the Data API
-- cannot see it (FG CLAUDE.md, "A new table — four parts"). Applying the rule now means this table
-- never depends on the auto-grant it would lose.

create table if not exists public.issue_faults (
  id          uuid        primary key default gen_random_uuid(),
  issue_id    uuid        not null references public.facility_issues(id) on delete cascade,
  note        text        not null,
  photo_url   text,
  opened_at   timestamptz not null default now(),
  opened_by   text        not null,
  cleared_at  timestamptz,
  cleared_by  text,
  clear_note  text
);

comment on table public.issue_faults is
  'One thing wrong with a machine (facility_issues). The machine is open while any fault is open. Aaron 2026-09-24: "there''s also another issue for the auto wash."';

create index if not exists issue_faults_open_idx on public.issue_faults (issue_id) where cleared_at is null;

alter table public.issue_faults enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'issue_faults' and policyname = 'issue_faults_all') then
    create policy issue_faults_all on public.issue_faults for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.issue_faults to anon, authenticated;
grant all on public.issue_faults to service_role;

-- ⭐ BACKFILL: one open fault per machine that is down right now, carrying exactly what the card shows
-- today — so the moment this applies, nothing on the lot reads differently.
--   · reopened → its CURRENT spell (the newest reopen): its note ('Not recorded' if blank), its photo,
--     its start, its author.
--   · open, never reopened → its first report: description (or title), its photo, reported_at.
-- Guarded by `not exists`, so running it twice cannot double the faults.
insert into public.issue_faults (issue_id, note, photo_url, opened_at, opened_by)
select f.id,
       coalesce(nullif(trim(e.note), ''), 'Not recorded'),
       e.photo_url,
       e.created_at,
       e.user_id
from public.facility_issues f
join lateral (
  select * from public.issue_events ev
  where ev.issue_id = f.id and ev.event_type = 'reopened'
  order by ev.created_at desc limit 1
) e on true
where f.status = 'reopened'
  and not exists (select 1 from public.issue_faults x where x.issue_id = f.id);

insert into public.issue_faults (issue_id, note, photo_url, opened_at, opened_by)
select f.id,
       coalesce(nullif(trim(f.description), ''), f.title),
       f.photo_url,
       f.reported_at,
       f.reported_by
from public.facility_issues f
where f.status = 'open'
  and not exists (select 1 from public.issue_faults x where x.issue_id = f.id);
