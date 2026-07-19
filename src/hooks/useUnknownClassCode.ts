// Self-reporting codex: when a key tag prints a class code the codex can't resolve, record it.
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

export async function logUnknownClassCode(code: string, plate: string): Promise<void> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  try {
    await supabase.from('unknown_class_codes').insert({ code: trimmed, plate: plate || null });
  } catch { /* non-blocking: never let telemetry break a scan */ }
}
