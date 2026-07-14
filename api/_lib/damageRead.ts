// The structured output of reading a DAMAGE photo — sibling to keytagRead. The operator
// snaps (and usually circles) the damage; the read turns it into a one-line description
// that seeds a damage hold's damageDescription. Editable downstream: the verify-later gate
// is the safety net, so a weak read is a nuisance to fix, never a bad write. Duplicated shape
// stays tiny on purpose — this file is part of the deployed function graph (Vercel transpiles
// api/ in isolation), so it imports nothing from src/.
export interface DamageRead {
  /** A concise operator-style description of the visible damage: type + location, e.g.
   *  "Scrape on the rear driver-side quarter panel". Undefined if nothing legible. */
  description?: string;
}
