// Undoing one entry in a vehicle's change log.
//
// ⭐ WHY THIS EXISTS. On 2026-08-22 a key-tag scan of LUR443 landed on LUR243's record and overwrote
// its identity — unit, make, model, year, colour, class, plus a class code, an owning number, a key
// count and the other car's tag photo. LUR243 is a real, different car (2025 Nissan Versa, blue,
// unit 5424882) carrying an "AC / heat issue" hold from May. Nothing was lost, because the log had
// every previous value; but putting them back took eleven hand-written fields, two of which the UI
// cannot even edit. The trail already knows how to undo itself. This lets it.
//
// ⚠️⚠️ AND IT REFUSES WHENEVER IT CANNOT BE SURE. A revert is only safe while the record still holds
// exactly what that entry set — if ANY of those fields has moved since, something happened
// afterwards, and quietly restoring an older value would undo a correction nobody asked it to touch.
// It then says which field drifted rather than reverting the rest, because a HALF revert leaves the
// record in a state that never existed on any real car.
//
// Same family as the plate ↔ owning check and the note matcher: when the machine cannot be certain,
// it surfaces the problem instead of acting.

/** One `{ from, to }` pair out of a log entry's `changed` payload. */
interface FromTo { from: unknown; to: unknown }

function isFromTo(v: unknown): v is FromTo {
  return !!v && typeof v === 'object' && 'from' in v && 'to' in v;
}

/** Values the trigger records as JSON — compared structurally, since jsonb columns arrive as objects. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;          // null vs undefined are the same absence here
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

export type RevertPlan =
  | { ok: true; patch: Record<string, unknown>; fields: string[] }
  | { ok: false; reason: string };

/**
 * What it would take to undo this log entry — or why it must not be undone.
 *
 * `current` is the vehicle row as it stands now, keyed by COLUMN name (the log speaks in columns).
 */
export function planRevert(
  changed: Record<string, unknown>,
  current: Record<string, unknown>,
  op: 'UPDATE' | 'DELETE' = 'UPDATE',
): RevertPlan {
  // A DELETE entry holds the whole row, not from/to pairs — re-creating a deleted car is a
  // different act with different consequences (new id, orphaned holds), and it is not this.
  if (op === 'DELETE') return { ok: false, reason: 'A deleted record cannot be restored from here.' };

  const pairs = Object.entries(changed).filter((e): e is [string, FromTo] => isFromTo(e[1]));
  if (pairs.length === 0) return { ok: false, reason: 'Nothing in this entry can be undone.' };

  const drifted = pairs.filter(([col, { to }]) => !sameValue(current[col], to)).map(([col]) => col);
  if (drifted.length > 0) {
    return {
      ok: false,
      reason: drifted.length === 1
        ? `${drifted[0]} has changed since — undoing this would overwrite that.`
        : `${drifted.length} of these fields have changed since — undoing this would overwrite them.`,
    };
  }

  const patch: Record<string, unknown> = {};
  for (const [col, { from }] of pairs) patch[col] = from ?? null;   // undefined would be ignored by the update
  return { ok: true, patch, fields: pairs.map(([col]) => col) };
}
