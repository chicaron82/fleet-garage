import type { KeytagRead } from '../../api/_lib/keytagRead';

/** What a failed scan still has worth keeping: its photo and whatever the read did manage. */
export interface ScanCarryover { photo: string; read: KeytagRead }

/**
 * Should a photographed scan's artifacts ride along when the operator identifies the car HIMSELF?
 *
 * ⭐⭐ Aaron, 2026-09-20, mining his camera roll for tags FG doesn't have: *"the scan was merely so
 * it would attach the keytag to the record that has it missing. and the scan would fill in the VIN
 * since the info is on the tag."* His tag was photographed sideways, the read came back with a class
 * code and no plate, and the moment he typed the plate himself the overlay dropped the photo — so
 * the one artifact that had NOT failed was thrown away, and the record he was feeding got nothing.
 * (`ac3deb7` fixed the identical mistake on the batch path: *"the photo was discarded because the
 * MODEL failed."*)
 *
 * ⚠️⚠️ ONLY WHEN THE SCAN RESOLVED NOTHING. A scan that matched a car has already attached its photo
 * (`useBackfillOnScan`), so carrying it onto a DIFFERENT typed plate would attach one car's tag to
 * another — the "a stale one would lie" case the original `setScanPhoto(null)` was right about.
 * Matched → nothing carries. This function exists to keep those two cases apart.
 *
 * ⚠️ And a typed lookup with no scan behind it carries nothing, which is the common case: he types a
 * plate because the scanner is down or he never photographed anything.
 */
export function failedScanCarryover(
  photo: string | null,
  read: KeytagRead | null,
  matched: boolean,
): ScanCarryover | null {
  if (!photo || !read || matched) return null;
  return { photo, read };
}

/**
 * The read to look up with: everything the failed scan managed, under the key HE typed.
 *
 * ⚠️ THE TYPED KEY WINS, always. He is holding the tag and the read already proved it could not
 * identify the car — so his plate/unit overwrites whatever the model thought it saw, and the rest
 * (VIN, class code, colour, owning area) rides along to fill the record's blanks exactly as a clean
 * scan would. Fills are blanks-only downstream and a disagreement is surfaced, never silently
 * written (`useBackfillOnScan`), so a field the sideways read got wrong costs a flag, not a record.
 */
export function readWithTypedKey(
  carried: ScanCarryover | null,
  key: { plate: string } | { unitNumber: string },
): KeytagRead {
  if (!carried) return key as KeytagRead;
  // The opposite key is dropped, not kept: a read that produced a plate FG could not find has no
  // business riding along beside the unit number he just typed.
  const { plate: _p, unitNumber: _u, ...rest } = carried.read;
  void _p; void _u;
  return { ...rest, ...key } as KeytagRead;
}
