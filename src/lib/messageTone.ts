import type { StatusTone } from './scanStatusLine';

// What KIND of thing a transient message is — the axis FG was missing.
//
// Aaron, 2026-08-26, on the open ticket: two surfaces were each inheriting a colour instead of
// choosing one, and they failed in opposite directions.
//   • TripStartForm rendered `✨ Registered LUR330 · 2026 Nissan Kicks` on Toast's DEFAULT tone,
//     which Toast itself documents as "the original red (alerts)". A success in the colour of a
//     problem, on the surface where he registers a car.
//   • AirportFlipSection hard-coded green — and fed that same element "Could not read that tag —
//     try again." and "Enter a plate to continue." It painted its own errors as success.
//
// ⭐ THE COLOURS ARE NOT THE MISSING PIECE — FG already has a full colour vocabulary in
// scanStatusLine (StatusTone + TONE_TEXT + TONE_BLOCK), and inventing a second one is how the EV
// control ended up with a dialect. What did not exist is the SEMANTIC axis: is this message good
// news, a heads-up, or a problem? That is the thing a call site actually knows and the renderer
// cannot infer.
//
// ⚠️ THREE TONES, NOT TWO. The ticket said "green the successes, keep warnings red", and binary
// would have forced `${plate} — not on file, capturing for the counter` into red — the SAME lie in
// the other direction, since nothing failed and the flip is proceeding. Amber is the honest answer
// and FG already had it.
export type MessageTone = 'success' | 'notice' | 'alert';

/** One mapping, so a message's KIND and its colour can never drift apart. */
export const MESSAGE_TONE: Record<MessageTone, StatusTone> = {
  success: 'green',
  notice: 'amber',
  alert: 'red',
};

/** A transient message plus what kind of thing it is. Carried together so the tone travels with
 *  the words instead of being decided by whoever happens to render them. */
export interface ToneMessage {
  message: string;
  tone: MessageTone;
}
