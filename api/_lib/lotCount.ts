// Erin St's count (lot_bay, one row), moved without losing a tap.
//
// ⚠️ WHY (line-check 2026-11-08, docs/ticket-erin-count-drops-a-tap.md). Every count write read the row, worked out the
// new numbers, and updated `id = 1` unconditionally. Two taps in flight together both read the same count and both
// wrote the same answer, so one tap vanished. The tap log shows it at least ten times: on Oct 15 three +1s from 0 saved
// 1, on Oct 16 four −1s from 6 saved 4. `used` lost the same taps.
//
// So the update only lands where the row still holds every number the change was computed from. Zero rows back means
// another tap got there first: read again, compute again. The count is one row and taps are seconds apart, so a few
// tries is plenty; past that it refuses with a sentence, never a stale write.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BayChange, BayRow } from './lotBay.js';

export const COUNT_TRIES = 5;

/** The sentence the phone shows if every try lost its race. */
export const COUNT_BUSY = 'The count was changing under that tap. Tap it again.';

export type CountCompute = (row: BayRow) => BayChange | { error: string } | null;

export type CountMove =
  | { kind: 'saved'; row: BayRow; saved: Record<string, unknown>; change: BayChange }
  | { kind: 'none'; row: BayRow }
  | { kind: 'refused'; error: string };

/** `eq` for a value, `is null` for a null: PostgREST's `eq.null` matches nothing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const holds = (q: any, col: string, v: unknown) => (v === null || v === undefined ? q.is(col, null) : q.eq(col, v));

export async function moveCountSafely(db: SupabaseClient, compute: CountCompute): Promise<CountMove> {
  for (let attempt = 0; attempt < COUNT_TRIES; attempt++) {
    const { data: row, error: readErr } = await db.from('lot_bay').select('cleans, dirties, used, used_on').eq('id', 1).single();
    if (readErr) throw readErr;
    const change = compute(row as BayRow);
    if (!change) return { kind: 'none', row: row as BayRow };
    if ('error' in change) return { kind: 'refused', error: change.error };

    let q = db.from('lot_bay').update(change.patch).eq('id', 1).eq('cleans', row.cleans).eq('used', row.used);
    q = holds(q, 'dirties', row.dirties);
    q = holds(q, 'used_on', row.used_on);
    const { data: saved, error } = await q.select().maybeSingle();
    if (error) throw error;
    if (!saved) continue;   // another tap landed between the read and this write: go again from what it left

    // The count has saved; the tap row is its trail. A lost trail is said in the log, never as a failed tap.
    const { error: tapErr } = await db.from('lot_bay_taps').insert(change.tap);
    if (tapErr) console.error('[lot] count saved, tap row not:', tapErr);
    return { kind: 'saved', row: row as BayRow, saved, change };
  }
  return { kind: 'refused', error: COUNT_BUSY };
}
