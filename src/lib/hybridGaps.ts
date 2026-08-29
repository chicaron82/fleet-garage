// Cars the fleet's own data says are hybrids, that nobody has flagged.
//
// ⭐⭐⭐ WHY THIS EXISTS, in Aaron's words (2026-08-29): *"we're building on top of things that
// already exist. scanned as one thing. built something to flag a difference. shows up makes
// correction. but now that only applies to vehicles that i have personally come across. there are
// probably several more that are different and don't match exactly."*
//
// Every powertrain correction FG has made was to a car he happened to touch. The loop is
// scan → flag → fix, and it only ever reaches cars that cross his path; whatever is wrong on a car
// he has not handled stays wrong, silently, forever.
//
// ⚠️ AND THE PROOF IS IN OUR OWN HISTORY. On 2026-08-28 I identified two Priuses as unflagged
// hybrids and told him in a message. On 2026-08-29 they are still unflagged — not because he forgot,
// but because **a finding delivered in conversation has nowhere to live.** This is the home.
//
// Pure: no DB, no React. The caller hands in the fleet it already holds.
import { lookupVehicleClass } from '../../api/_lib/vehicleClassCodex';

/** What asserted that this car is a hybrid. */
export type HybridGapReason = 'rental-class' | 'model-code';

/** The narrow shape this needs — a subset of Vehicle, keeping the module decoupled. */
export interface HybridGapVehicle {
  id: string;
  licensePlate: string;
  year: number;
  make: string;
  model: string;
  classCode?: string | null;
  rentalClass?: string | null;
  isHybrid?: boolean | null;
}

export interface HybridGap<V extends HybridGapVehicle = HybridGapVehicle> {
  vehicle: V;
  /** Everything that says hybrid, so he can weigh it rather than take FG's word. */
  reasons: HybridGapReason[];
}

/**
 * Cars where something asserts HYBRID and the flag is off.
 *
 * ⚠️⚠️ IT IS DELIBERATELY ONE-DIRECTIONAL, AND THAT ASYMMETRY IS AARON'S. A hybrid wearing an ICE
 * model code is NOT a disagreement — it is the correct workaround when the real code is unknown:
 * *"the civic model code is correct for an ICE version... that hybrid civic is the first time i've
 * seen it. i do not know the real hybrid code for it. so having the hybrid flag works."* The code
 * records what is PRINTED; the flag records what is TRUE. So this may say "the flag looks missing"
 * and must never say "the flag looks wrong".
 *
 * ⚠️ E6 is Hertz's powertrain-hybrid group — verified 40 for 40 on 2026-08-28 — which is why an E6
 * car without the flag is a near-certain miss. `hybridFromRentalClass` stays one-way for the same
 * reason: not-E6 never means not-hybrid, so a hybrid outside E6 is unremarkable and unlisted.
 */
export function hybridFlagGaps<V extends HybridGapVehicle>(vehicles: readonly V[]): HybridGap<V>[] {
  const out: HybridGap<V>[] = [];
  for (const vehicle of vehicles) {
    if (vehicle.isHybrid) continue;                 // never second-guess a flag he has set
    const reasons: HybridGapReason[] = [];
    if ((vehicle.rentalClass ?? '').trim().toUpperCase() === 'E6') reasons.push('rental-class');
    if (lookupVehicleClass(vehicle.classCode)?.isHybrid) reasons.push('model-code');
    if (reasons.length) out.push({ vehicle, reasons });
  }
  return out.sort((a, b) => a.vehicle.licensePlate.localeCompare(b.vehicle.licensePlate));
}

/** What said so, in words — the evidence, never a verdict. */
export function describeHybridGap(gap: HybridGap): string {
  const parts = gap.reasons.map(r =>
    r === 'rental-class' ? 'its rental class is E6' : `its model code ${gap.vehicle.classCode} is a hybrid code`);
  return parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0] ?? '';
}
