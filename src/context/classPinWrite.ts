import { supabase, writeWithRefresh } from '../lib/supabase';
import { classPinContradiction, type ClassPinContradiction } from '../../api/_lib/vehicleClassCodex';

// PIN a class code → rental class mapping, because a person just decided it.
//
// ⭐ FG had already solved this problem one level up and never one level down. `field_sources`
// (inferred < tag < manual) stops a later scan from clobbering a hand-corrected field ON A CAR.
// But the code→class mapping is SHARED, and it had no ladder at all: `api/keytag-read.ts` upserted
// it on every scan that read a code and a class, last-write-wins. So correcting one RAV4 locked
// that RAV4 — and the next CRHX scanned still got Q4, because the table underneath had already
// re-taught itself from the tag.
//
// Aaron, 2026-08-25: *"saves me from constantly changing it."* He was not asking for a shortcut.
// He was describing a loop with no exit: his fix could not survive a single scan.
//
// So a manual class edit teaches the MAPPING too, and marks it pinned so the scan may read it but
// never overwrite it (migration 127). Same rule as field_sources, one level down.
//
// ⚠️ Best-effort by design. A failed pin must never fail the vehicle edit the operator actually
// asked for — the car's own record is the thing he came to fix; the mapping is the bonus. It
// returns whether it landed so the caller can be honest rather than assume (the R61/R62 lesson:
// a success message that claims a write which never happened).
/** What the pin did, and when it refused, why. Richer than the old boolean because "did not pin"
 *  and "REFUSED to pin, and here is the code you probably meant" are different things to tell him —
 *  a silent skip is the catch-that-said-nothing shape. */
export interface PinOutcome {
  pinned: boolean;
  /** Set when the pin was refused because the codex contradicts it. */
  contradiction?: ClassPinContradiction;
}

export async function pinClassMapping(
  classCode: string | null | undefined,
  rentalClass: string | null | undefined,
): Promise<PinOutcome> {
  const code = (classCode ?? '').trim().toUpperCase();
  const cls = (rentalClass ?? '').trim().toUpperCase();
  // BOTH or nothing. A code with no class teaches nothing, and a class with no code has no key —
  // writing either would put a half-row in a table the scanner reads as authority.
  if (!code || !cls) return { pinned: false };

  // ⭐⭐ REFUSE A PIN THE CODEX CONTRADICTS. On 2026-08-28 this exact path pinned `CSPT → E6` from a
  // Sportage hybrid wearing a mis-printed ICE tag — true of that car, false of the eleven petrol
  // Sportages, and LOCKED, so no scan could undo it. A per-car observation must not become a
  // per-code rule when FG already holds the fact that makes it wrong.
  //
  // ⚠️ It blocks only the SHARED mapping. The car's own edit still lands in full — that is the thing
  // he came to fix, and this write has always been the bonus.
  const contradiction = classPinContradiction(code, cls);
  if (contradiction) return { pinned: false, contradiction };

  // The module owns "who pinned it" — the caller shouldn't have to fetch an identity just to
  // record one, and a caller that forgets would silently write an anonymous pin.
  const { data: who } = await supabase.auth.getUser();

  const { error } = await writeWithRefresh(() =>
    supabase.from('class_code_rental_class').upsert(
      {
        code,
        rental_class: cls,
        pinned_at: new Date().toISOString(),
        pinned_by: who?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'code' },
    ));
  return { pinned: !error };
}
