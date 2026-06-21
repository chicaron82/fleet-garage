-- 084: airport "Flipping Returns" — a manual attestation
--
-- The shift report's airport-flip flag is derived from a VSA logging 'airport_flip'
-- OTH time IN FG. But flips are routinely run by people who don't use FG (a closing
-- partner sent to the airport, a roster-only morning crew), so a real turnaround
-- leaves no trace and the resulting light bay count reads unexplained.
--
-- Add a manual attestation the FG-using lead can check at either touch point — the
-- morning handoff (handoff_notes) or the close (washbay_logs) — so "quick
-- turnarounds happened today" is recorded regardless of who did them. The report
-- ORs both alongside the existing OTH signal.

alter table washbay_logs  add column if not exists airport_flipping boolean not null default false;
alter table handoff_notes add column if not exists airport_flipping boolean not null default false;
