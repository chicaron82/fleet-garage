import type { Disposition } from '../types';

// Which KIND of departure a sale car is — and deliberately nothing more.
//
// ⭐⭐ Aaron, 2026-09-02, specifying the closing inventory: three kinds of car are never written up
// — sale, turnback and buy-back — and FG could only see one, so any exclusion it performed was one
// third complete while looking total. His fix: *"what about putting turn back and buy backs as a
// type under sale car when flagging"*.
//
// ⚠️⚠️ THIS IS A LABEL. NOTHING BRANCHES ON IT, AND THAT IS THE DESIGN, NOT AN OVERSIGHT.
// All three behave identically: don't clean, don't write up. The Flag Issue card already calls it
// "a disposition flag, not a damage record". Made siblings of `sale_car` in the hold TYPE, every
// consumer would have to learn three values and the inventory rule would grow a list to fall out of
// date; as a sub-type there is one hold type, one rule, and three names for it.
//
// ⭐ And the reason it must stay a label is his own sentence: *"I don't know the difference between
// the two. they're leased from the dealership I think."* If FG made them behave differently he would
// have to understand the distinction before he could file one. As a label he records what the
// paperwork says, and the distinction is captured now in case it ever needs to mean something.
//
// ⚠️ SO: if you are about to write `if (disposition === 'turnback')`, stop and go ask what a
// turnback actually is. Do not infer one from the name.
//
// ⭐ SALVAGE, the fourth (Aaron, 2026-09-25): LUR337, a '26 Kicks with hail damage to the windshield,
// hood and roof from July. *"Damaged. Assessed and too much to fix. Going for salvage."* It's another
// car leaving and not coming back, so it's another name for the same behaviour (don't clean, don't
// write up) and not a new hold type.

/** Ordered as they appear on the form: the common one first. */
export const DISPOSITIONS: readonly Disposition[] = ['sale', 'turnback', 'buyback', 'salvage'];

/** The tile's own shorthand — the letters he would write on a key tag. */
export const DISPOSITION_LABELS: Record<Disposition, string> = {
  sale:     'Sale',
  turnback: 'TB',
  buyback:  'BB',
  salvage:  'Salvage',
};

/** Spelled out, for anywhere with room (a hold record, an export). */
export const DISPOSITION_LONG: Record<Disposition, string> = {
  sale:     'Sale car',
  turnback: 'Turnback',
  buyback:  'Buy-back',
  salvage:  'Salvage',
};

export function isDisposition(v: string | null | undefined): v is Disposition {
  return !!v && (DISPOSITIONS as readonly string[]).includes(v);
}

/**
 * What to call it. ⚠️ A `sale_car` hold with NO disposition reads as a plain SALE — every hold
 * filed before migration 136 has a null here, and none of them changed meaning when the column
 * arrived. An unrecognised value falls back the same way rather than rendering a raw string.
 */
export function describeDisposition(v: string | null | undefined): string {
  return isDisposition(v) ? DISPOSITION_LONG[v] : DISPOSITION_LONG.sale;
}
