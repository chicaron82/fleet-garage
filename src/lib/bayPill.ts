// The header's bay pill, pure: what one tap does to the car in the bay, and the words it says doing it.
// Aaron, 2026-11-15: *"if i happen to navigate away from the lot lookout module a pill would show in the header. tapping
// it finishes the clean and if something's already on deck starts it."* Ticket: docs/ticket-header-bay-pill.md.
//
// • The tap is the card's ✓ Clean. The server's exit already brings the on-deck car in, so the pill only names it.
// • A hold flagged since the car came in makes the only way out "close it as held" (bayHeldSince), on the card AND here,
//   so a quick tap never sends a held car out as a Clean with +1 on the cleans.
// • The face is the PLATE, never a time: the bay log's rule, *"Durations, NEVER"* (lib/lotBayLog header).
// • Narrow on purpose (rendered at 412 with a trip pill and the Erin pill up, 2026-11-15): a sponge emoji on the yellow
//   pill pushed the trip pill under the logo, and a held chip that named both cars pushed the camera and menu 69 px off
//   the screen. So the face is the plate alone (the yellow says "the bay"), the held chip is just ✓, and the car coming
//   in is named AFTER, in the saved word. The full sentence always rides on the label.
import type { BayLogRow, BayMark } from './lotBayLog';

export interface BayPillPlan {
  /** What goes to the server when the hold runs out. */
  exit: 'clean' | 'mhold' | 'bhold';
  /** The pill at rest. */
  face: string;
  /** The pill while the tap is held, beside Undo. */
  chip: string;
  /** The word once it saved: the car on deck coming in, when there is one. */
  done: string;
  /** The screen reader's words for the pill at rest, and for the held chip. */
  label: string;
  heldLabel: string;
}

/** `onDeck`: the plate lined up behind it, or null. The car's own plate on the slot is a stale slot, not a car waiting
 *  (BayOpenCar's `waiting` reads it the same way). */
export function bayPillPlan(open: Pick<BayLogRow, 'plate'>, held: BayMark | null, onDeck: string | null): BayPillPlan {
  const { plate } = open;
  const next = onDeck && onDeck !== plate ? onDeck : null;
  const comesIn = next ? `, ${next} comes in` : '';
  const done = next ? `✓ ${next} in` : '✓ Saved';
  if (held) {
    const what = held.kind === 'mhold' ? 'M hold' : 'B hold';
    return {
      exit: held.kind,
      face: `${held.kind === 'mhold' ? '🔧' : '⚠️'} ${plate}`,
      chip: held.kind === 'mhold' ? '🔧' : '⚠️',
      done,
      label: `${plate} in the bay, held. Tap to close it as ${what}${comesIn}`,
      heldLabel: `${plate} closing as ${what}${comesIn}. Undo`,
    };
  }
  return {
    exit: 'clean',
    face: plate,
    chip: '✓',
    done,
    label: `${plate} in the bay. Tap to finish the clean${comesIn}`,
    heldLabel: `${plate} clean${comesIn}. Undo`,
  };
}
