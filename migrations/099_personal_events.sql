-- 099: Important dates FG should remember FOR Aaron (docs/ticket-personal-events.md).
-- The recall→knowing thesis turned inward: FG knows his shift, his lot, his rates — but nothing
-- about his day as a person in that building. A staff BBQ at 12:30 lives on a break-room poster
-- and in his head, and gets half-remembered at 12:45. This holds a handful of DATED notes that
-- surface on My Day on the day, then retire.
--
-- Deliberately a THIRD thing, distinct from the two neighbours:
--   * whiteboard_notes reminder  — a transient NEXT-SHIFT task that auto-clears after that shift
--   * effie memory               — a durable FACT about the operator, with no date at all
--   * personal_events (this)     — an event at a specific DATE (+ optional time) that surfaces
--                                  on that date and is simply past afterwards.
--
-- Scope guardrail (Aaron, 2026-07-16): a handful of dated notes, NOT a calendar. No recurrence,
-- no invites, no month grid — the moment it grows those it stops being his cockpit and becomes
-- Outlook. RLS allow-all (FG trusted-crew, [[project_fg_scope_boundary]]).
create table if not exists public.personal_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  event_date  date not null,
  event_time  time,                 -- null = all-day / time unknown ("Staff BBQ today")
  title       text not null,
  created_at  timestamptz not null default now()
);

comment on table public.personal_events is
  'Dated personal notes surfaced on My Day on the day (staff BBQ, a meeting). Distinct from whiteboard reminders (next-shift, auto-clearing) and Effie memories (durable, undated). A handful of dates, never a calendar. See docs/ticket-personal-events.md.';

-- The only read the app makes: this user, this date (My Day asks "anything today?").
create index if not exists personal_events_user_date_idx
  on public.personal_events (user_id, event_date);

alter table public.personal_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'personal_events' and policyname = 'personal_events_all'
  ) then
    create policy personal_events_all on public.personal_events for all using (true) with check (true);
  end if;
end $$;
