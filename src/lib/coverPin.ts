// Which photo becomes the vehicle's card photo when a hold is created.
//
// Aaron, 2026-08-27, looking at the Holds worklist mid-shift: *"pretty sure we made it so if only 1
// photo is used for a hold, that's the one that gets automatically pinned."* Right about the intent,
// and the rule was not there — three of the holds on his screen had exactly one photo and no cover.
//
// ⭐ THE AFFORDANCE WAS BUILT FOR THE AMBIGUOUS CASE AND THE UNAMBIGUOUS ONE FELL THROUGH IT. Tapping
// a photo to pin it exists to answer *"which of these?"*. With a single photo there is nothing to
// choose between, so he never taps, so nothing pins, and the row renders with no thumbnail beside
// cars that have one. Asking a question with only one possible answer is not a safeguard; it is a
// step nobody takes.
//
// ⚠️ FIRST DRAFT OF THIS SAID "exactly one, and no further" — that with 2+ photos FG must not guess.
// Aaron widened it the same morning: *"what do you think of just marking the first photo if there are
// multiple. I can always change it later too."* He is right, and the reason I was wrong is worth
// keeping: **I applied a high-stakes guard to a low-stakes decision.**
//
// "Don't guess" is correct for a PLATE and for an ODOMETER, because those write DATA and a wrong one
// is a lie that persists. A cover photo is a DISPLAY CHOICE with a one-tap undo. Weighed properly it
// is not close:
//   • auto-pin the first, wrongly → a less representative photo on the card. One tap to fix.
//   • pin nothing                 → NO THUMBNAIL AT ALL, indistinguishable from a hold with no
//                                   photos. Strictly less information.
// Something beats nothing. And the first photo is not random — it is the one he chose to take first,
// which is usually the thing he was actually looking at.
//
// ⭐ It also collapses a divergence: `useProposalConfirm` (Effie's register-and-hold) has always
// pinned `photoUrls[0]` at any count. Two surfaces were answering one question differently — the
// exact shape that had two of my own hooks disagreeing about which repos use tickets. One answer now.
//
// An explicit tap still wins at any count: this adds a default, it does not take the choice away.

/**
 * The index to pin, given what the operator explicitly chose and how many photos there are.
 * Null means pin nothing.
 */
export function effectivePinnedIndex(explicit: number | null, photoCount: number): number | null {
  if (explicit !== null) return explicit;          // his tap wins, always
  return photoCount > 0 ? 0 : null;                // a default beats an empty card; he can change it
}

/**
 * ⚠️ Guards the index against the photo list it will be used on. Uploads can FAIL and get filtered
 * out, which shifts every index after them — pinning by a stale index would put someone else's photo
 * on the car. The original code guarded this by refusing to pin whenever the counts disagreed; this
 * keeps that intent and states it as a bounds check, so a single-photo auto-pin cannot resurrect the
 * bug by skipping the comparison.
 */
export function coverPhotoUrlFor(
  explicit: number | null,
  photos: readonly string[],
  uploadedUrls: readonly string[],
): string | null {
  if (photos.length !== uploadedUrls.length) return null;   // an upload dropped — indices unreliable
  const index = effectivePinnedIndex(explicit, uploadedUrls.length);
  if (index === null || index < 0 || index >= uploadedUrls.length) return null;
  return uploadedUrls[index];
}
