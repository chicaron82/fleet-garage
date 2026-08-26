import type { ShiftType } from '../types';

// Whether the "Start opening duties" card belongs on screen at all — Aaron, 2026-08-26, looking at
// My Day at 18:26 on a shift he finished at 15:45, with the card still offering to start his morning:
//
//   *"start opening duties on my day should have a dismiss, in the event my partner comes in before
//    me and does everything already. if i have logged it, it should hide itself. i don't need to log
//    opening duties again"*
//
// ⭐ TWO DIFFERENT REASONS THE CARD IS WRONG, and they need separate exits — collapsing them into
// one would leave a real case uncovered:
//
//   • **Logged** — he did it. The card is stating a fact that is no longer true, so it removes
//     ITSELF; asking him to dismiss something the database already knows is finished is make-work.
//   • **Dismissed** — nobody logged it *under his name* and nobody will, because his partner got in
//     first and did the gas, keys and boards. There is nothing to detect: the work happened, just
//     not by him. Only he can say so, so this one needs a tap.
//
// The distinction matters because the second case leaves NO trace in FG at all. A design that only
// auto-hid on a logged entry would leave the card sitting there every time someone beat him in.
export interface OpeningQuickStartState {
  shiftType: ShiftType | undefined;
  /** Is he at work today at all (the roster's answer, incl. an OT day-off). */
  working: boolean;
  /** An `opening_duties` off-standard entry already exists for him today. */
  logged: boolean;
  /** He tapped dismiss today. */
  dismissed: boolean;
}

export function shouldShowOpeningQuickStart(s: OpeningQuickStartState): boolean {
  if (!s.working || s.shiftType !== 'opening') return false;
  return !s.logged && !s.dismissed;
}

/**
 * Dismissal is PER DAY, and the date is in the key rather than in a value.
 *
 * ⚠️ A single `openingDutiesDismissed = true` would silence the card FOREVER — one partner beating
 * him in on a Tuesday would hide his own quick-start every opening after it. Keying by date means
 * tomorrow starts fresh with no expiry logic to get wrong, and a stale key is inert rather than
 * harmful.
 *
 * Local to the device on purpose: "my partner already did it" is a fact about THIS morning on the
 * phone in his hand, not a fleet record. It has no business in the database.
 */
export function dismissKeyFor(dateISO: string): string {
  return `fg.openingDuties.dismissed.${dateISO}`;
}
