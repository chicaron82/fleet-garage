// Re-reading a key tag FG already has on file.
//
// ⭐ WHY THIS EXISTS. Aaron, looking at the 45-car audit queue his camera-roll batch produced:
// *"having to find 45 keytags from ~150 to reupload is a hassle lol isn't there a better solution.
// can't it just be re-read and filled out? leaving the key count?"*
//
// It can. Every one of those cars already has its tag photo stored — the fields were dropped by the
// write path, not by the photo. So the honest fix for the backlog is to read the photos FG is
// already holding, rather than asking him to find the same images a second time.
//
// ⚠️⚠️ AND IT MUST NOT GO THROUGH `resolveKeytagScan`. That function finds the car BY PLATE, which
// is exactly right when a photo arrives from a camera with no context — and exactly wrong here.
// We already know whose tag this is: it is the one stored on the record. Routing a re-read through
// a plate lookup would mean a misread plate writes car A's tag values onto car B — a whole class of
// silent cross-contamination that simply cannot occur if the vehicle is passed in. So the vehicle
// is an INPUT here, never a lookup.
import { resolveKeytag, type KeytagFill, type KeytagChange, type KeytagConflict } from './resolveKeytag';
import { keytagExistingFrom, lockedFromSources } from './resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../types';

export interface RereadPlan {
  /** Blank fields the stored photo can fill. The only thing a re-read ever writes. */
  fills: KeytagFill[];
  /** Non-blank fields the read DISAGREES with. Reported, never applied — see below. */
  disagreements: (KeytagChange | KeytagConflict)[];
}

/**
 * What a re-read of a stored tag may do to its own car.
 *
 * ⚠️⚠️ FILLS ONLY. A live scan applies an unlocked CHANGE — the operator is standing at the car
 * holding the tag, sees the warning, and can undo it. A bulk re-read has none of that: nobody is
 * watching, and the tag it is reading is the same one that produced the current value, so a
 * disagreement means the MODEL changed its mind, not that the car did. Applying those would let a
 * second opinion silently overwrite a first one across the whole fleet at once.
 *
 * ⭐ Blanks carry no such risk: filling one replaces nothing. That asymmetry is the whole safety
 * argument for running this unattended, and it is why disagreements are counted and surfaced rather
 * than dropped — they are the cars worth his eyes.
 */
export function planKeytagReread(read: KeytagRead, vehicle: Vehicle): RereadPlan {
  const resolution = resolveKeytag(read, keytagExistingFrom(vehicle), lockedFromSources(vehicle.fieldSources));
  if (resolution.kind !== 'partial') return { fills: [], disagreements: [] };
  return {
    fills: resolution.fills,
    disagreements: [...resolution.changes, ...resolution.conflicts],
  };
}

/**
 * ⚠️ THE KEY COUNT IS NOT IN HERE, AND CANNOT BE — Aaron's own boundary: *"some of these photos
 * have # of keys in them so they'd still need my eyes… but the tag info could pretty much all be
 * filled in."*
 *
 * It is not a `KeytagField`, so no resolver path can reach it; this note exists because that is
 * currently true by ACCIDENT of the type rather than by decision, and a future field added to
 * `KeytagField` would inherit this job silently. The count is read off a ring in a photo, not off
 * printed text — a different kind of claim, and his to make.
 */
export const REREAD_NEVER_WRITES = ['keyCount'] as const;
