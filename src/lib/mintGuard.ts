// Match-before-mint: the guard that stops registration from creating DUPLICATE vehicle rows.
//
// The bug it kills (cleaned up live 2026-08-05 — LFJ370, LUR345, SB085H, LUR266 each had 2 rows):
// several paths mint a vehicle (register, keytag-scan auto-register, flip, overflow, proposal
// confirm, batch), and they weren't cross-checking the fleet before inserting — so a car already on
// record got a SECOND row with a fresh id. addVehicle is the convergence point; this decides, from
// the already-plate-matched existing row, whether to mint, reuse, or upgrade — so the rule lives in
// ONE place instead of being re-forgotten per path.
//
// Pure: the caller finds the existing non-archived row by normalized plate and passes it in.

export interface MintExisting {
  id: string;
  unitNumber: string | null;
  /** Archived rows never block a mint — a returning/re-plated car is a fresh registration. */
  archivedAt?: string | null;
}

export type MintDecision =
  | { action: 'mint' }               // no live match, or same plate + a genuinely different unit
  | { action: 'reuse'; id: string }  // same plate + same unit already on record → short-circuit
  | { action: 'upgrade'; id: string }; // plate-only stub (no unit) → fill the unit in place, don't mint

/**
 * Decide what to do when registering `newUnitNumber` on a plate whose (non-archived) fleet match is
 * `existing`:
 *  - no live match → MINT.
 *  - existing is a plate-only stub (no unit) and we now have a unit → UPGRADE the stub in place (the
 *    LFJ370 class: a plate-only PRE_EXISTING stub the unit registration should have filled, not doubled).
 *  - same plate + same unit already on record → REUSE (the LUR345/SB085H class: two mint paths, no
 *    cross-check). Also reuse when the new registration carries no unit — nothing new to add.
 *  - same plate + a genuinely DIFFERENT unit → MINT: can't tell plate-reuse from a typo at mint time,
 *    so allow it; the dedupe sweep catches a genuine typo (that's how LUR266's …115/…118 was found).
 */
export function decideMint(existing: MintExisting | undefined, newUnitNumber: string | null | undefined): MintDecision {
  if (!existing || existing.archivedAt) return { action: 'mint' };
  const existingUnit = (existing.unitNumber ?? '').trim();
  const newUnit = (newUnitNumber ?? '').trim();
  if (!existingUnit && newUnit) return { action: 'upgrade', id: existing.id };
  if (!newUnit || existingUnit === newUnit) return { action: 'reuse', id: existing.id };
  return { action: 'mint' };
}
