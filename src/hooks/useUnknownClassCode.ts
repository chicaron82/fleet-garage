// The codex's two-way loop: REPORT the codes FG can't resolve, and LEARN the ones Aaron teaches.
//
// Before this, an unknown code was invisible — the scan just quietly refused to offer
// registration and the operator had to work out WHY (Aaron did, correctly, from the shape of the
// failure: "is it because older Durango uses CDR8?"). Codes only got added when he happened to
// get blocked at a car and message me. Logging them turns the codex from reactive to
// self-reporting: the codes accumulate on their own and get added in a batch, before the next
// person is stuck in a lot holding a car for PM.
//
// Append-only and fire-and-forget — a failed log must never interfere with the scan.
import { supabase } from '../lib/supabase';
import { normalizeClassCode } from '../../api/_lib/vehicleClassCodex';

export async function logUnknownClassCode(code: string, plate: string): Promise<void> {
  const trimmed = normalizeClassCode(code);
  if (!trimmed) return;
  try {
    await supabase.from('unknown_class_codes').insert({ code: trimmed, plate: plate || null });
  } catch { /* non-blocking: never let telemetry break a scan */ }
}

/** Teach FG a class code, from the one moment the operator is certain: registering the car with
 *  the tag in his hand. Until now the codex only grew when he got stuck, messaged me, and I
 *  hand-added a mapping in a commit — reactive, and it cost a deploy every time. Now the mapping
 *  lands the moment he does the work he was doing anyway, and the NEXT scan of that code resolves.
 *
 *  Upsert, so re-teaching the same code is also the edit path (a typo'd mapping is fixed by
 *  registering the next car of that class correctly). Consulted server-side ONLY when the curated
 *  table misses, so a taught row can never silently override a vetted mapping.
 *
 *  Fire-and-forget: teaching must never break the registration that triggered it. */
export async function teachClassCode(code: string, make: string, model: string, taughtBy?: string): Promise<void> {
  const key = normalizeClassCode(code);
  if (!key || !make.trim() || !model.trim()) return;
  try {
    await supabase.from('vehicle_class_codex').upsert({
      code: key,
      make: make.trim(),
      model: model.trim(),
      taught_by: taughtBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'code' });
    // It's answered now — stop it showing up as an open gap in the self-reported list.
    await supabase.from('unknown_class_codes').delete().eq('code', key);
  } catch { /* non-blocking: never let learning break a registration */ }
}
