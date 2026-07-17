// Write an important date FG should remember (migration 099) — the confirm-tap half of Effie's
// propose_event. Sibling of addWhiteboardReminder: same shape (a proposal-confirm write living in
// lib so useProposalConfirm stays a dispatcher, not a place writes are hand-rolled).
//
// Locked. The insert mints a fresh server-side row id, so a same-frame double-tap on "Remember it"
// would write the BBQ twice — the card's `submitting` state can't close that window (it only
// applies on the next render), which is exactly the class the submit-lock contract test fences.
// Keyed on the logical event (user + date + title): the same date confirmed twice is one row, but
// two genuinely different notes on the same day never block each other.
import { supabase, writeWithRefresh } from './supabase';
import { withSubmitLock } from './submitLock';

/** Save a dated note for the operator. Returns false on failure (the caller throws for the card). */
export async function addPersonalEvent(args: {
  userId: string;
  title: string;
  date: string;          // YYYY-MM-DD
  time: string | null;   // 'HH:MM' or null for an all-day note
}): Promise<boolean> {
  const title = args.title.trim();
  const key = `event:${args.userId}:${args.date}:${title.toLowerCase()}`;
  const result = await withSubmitLock(key, async () => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('personal_events').insert({
        user_id:    args.userId,
        event_date: args.date,
        event_time: args.time,
        title,
      }));
    return !error;
  });
  // A dropped re-entrant call resolves undefined — the first call is doing the work, so the
  // confirm still reads as success rather than surfacing a false error.
  return result ?? true;
}
