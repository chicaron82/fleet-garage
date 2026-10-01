import { supabase, writeWithRefresh } from '../lib/supabase';

// FORGET something FG learned about a model code — the only write the Model codes audit offers.
//
// ⭐ Aaron, 2026-10-01: *"can we have somewhere i can see FG's learned model codes to audit"*. Seeing a
// bad lesson (`Q4 → O`, `CKRG → CA`, `CX4L → C`) is half of an audit; the other half is being able to
// remove it from his phone instead of asking for it to be removed.
//
// ⚠️⚠️ A WRITE THAT FAILS MUST SAY SO (CLAUDE.md), and a delete has a quiet way to fail: with a policy
// in the way, PostgREST answers "0 rows" and NO error. So both functions ask for the deleted rows back
// and throw when none came — "nothing was removed" is a failure here, never a success.
//
// ⚠️ A PIN IS NOT A LESSON. `forgetLearnedClass` only matches rows with `pinned_at IS NULL`, in the
// query itself, so a pinned class cannot be deleted through this path even if a screen offered it.
// A pin is his decision (classPinWrite); undoing one is a different act from clearing a misread.
// docs/October/ticket-model-codes-he-can-audit.md

const key = (code: string) => code.trim().toUpperCase();

/** Forget an UNPINNED code → rental class lesson. Throws if nothing was removed. */
export async function forgetLearnedClass(code: string): Promise<void> {
  const k = key(code);
  if (!k) throw new Error('no code to forget');
  const { data, error } = await writeWithRefresh(() =>
    supabase.from('class_code_rental_class').delete().eq('code', k).is('pinned_at', null).select('code'));
  if (error || !data || data.length === 0) throw new Error('learned class not forgotten');
}

/** Forget a TAUGHT code → make + model. The built-in list lives in code and is untouched. */
export async function forgetTaughtModel(code: string): Promise<void> {
  const k = key(code);
  if (!k) throw new Error('no code to forget');
  const { data, error } = await writeWithRefresh(() =>
    supabase.from('vehicle_class_codex').delete().eq('code', k).select('code'));
  if (error || !data || data.length === 0) throw new Error('taught model not forgotten');
}
