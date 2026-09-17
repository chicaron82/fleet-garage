// What happens to the board photo when a hand-off is saved — uploaded, or carried forward.
//
// ⚠️⚠️⚠️ WHY THIS IS ITS OWN PURE FUNCTION: IT SHIPPED BROKEN ONCE, AND THE BREAK WAS SILENT.
//
// On 2026-09-16 the logged hand-off card became tappable to EDIT (Aaron: *"Show it if already logged,
// with tap to edit"*), and HandoffForm started seeding its `photo` state from the stored hand-off —
// which holds a **URL**. But `submitHandoff`'s `photo` means *freshly captured base64*, and it
// uploaded anything truthy. So editing a hand-off that had a board photo handed a URL to
// `base64ToBlob`, at the storage path `handoff/{branch}-{date}-{user}.jpg` — **the same path the
// original photo lives at.** Either the decode threw and the new row saved with no photo, or a
// garbage blob overwrote the real image that the OLD row also points to.
//
// Found at the day's /reflect, not by the verification that shipped it: that verification opened
// the edit form on a hand-off with **no photo**, so the path that breaks was never exercised.
//
// ⭐ The closing log already carries a scar from this exact family ("NO NEW PHOTO MUST MEAN DON'T
// TOUCH, NOT SET NULL") and solves it by OMITTING the column from an UPSERT. **That trick does not
// transfer**: a hand-off INSERTS a fresh row every save, so omitting the column means NULL. The
// carry-forward has to be explicit, which is what `keep` is.

export type HandoffPhotoPlan =
  | { readonly kind: 'upload'; readonly base64: string }
  | { readonly kind: 'keep'; readonly url: string | null };

/**
 * Decide the photo for a hand-off row about to be inserted.
 *
 * - A new capture (base64) is uploaded.
 * - No new capture keeps the existing photo's URL — on an edit, the board photo survives.
 * - ⚠️ A value that is already a URL is NEVER uploaded, whoever passed it. Defence in depth: the bug
 *   this exists for was a caller putting a URL where base64 belonged, and the upload path overwrites
 *   by key, so the cost of that mistake is the original image. Treating a URL as "keep" makes the
 *   mistake harmless instead of destructive.
 */
export function planHandoffPhoto(
  newPhoto: string | null | undefined,
  existingUrl: string | null | undefined,
): HandoffPhotoPlan {
  const fresh = (newPhoto ?? '').trim();
  if (fresh && /^https?:\/\//i.test(fresh)) return { kind: 'keep', url: fresh };
  if (fresh) return { kind: 'upload', base64: fresh };
  return { kind: 'keep', url: existingUrl ?? null };
}
