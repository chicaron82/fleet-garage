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
// ⚠️ EXACTLY ONE, and no further. With two or more, which photo best represents the car is a real
// judgement — an auto-pick there would be FG guessing at damage it cannot see. And an explicit tap
// always wins, at any count: the whole point is to add a default, not to take the choice away.

/**
 * The index to pin, given what the operator explicitly chose and how many photos there are.
 * Null means pin nothing.
 */
export function effectivePinnedIndex(explicit: number | null, photoCount: number): number | null {
  if (explicit !== null) return explicit;          // his tap wins, always
  return photoCount === 1 ? 0 : null;              // nothing to choose between → choose it
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
