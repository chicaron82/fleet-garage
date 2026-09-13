import { normalizePlate, confusableKey, plateShape } from './fleetAudit';
import { isLeadingTruncation } from './clippedRead';

// Is a tag's plate different from the record's because the READ was wrong, or because the CAR was
// RE-PLATED? — Aaron, 2026-08-26, with a Suburban that came from Alberta and got MB plates that day.
//
// FG treats both the same way. `ScanRouterOverlay` holds the rule *"once a vehicle RESOLVED, its
// record is authoritative for the plate"*, which is correct for a misread — the cheap reader is
// ~87.5% on plates against ~97.5% on unit numbers, so roughly one read in eight resolves correctly
// VIA THE UNIT while carrying a wrong plate. Handing that plate back would print a plate the car
// does not have, on the card he uses to identify the car in his hand.
//
// ⚠️ But a RE-PLATE is the one case where the TAG is more current than the record, and the same rule
// silently keeps the old plate forever.
//
// ⭐ THE TWO ARE TRIVIALLY DISTINGUISHABLE, and Aaron said why without meaning to:
// *"the only change on a replate is the plate."* A re-plated car keeps its unit, VIN, class code,
// colour and options — it crosses provinces carrying everything but that one line. So:
//
//   • A MISREAD is the SAME plate seen badly: LUR143 → LURL43, 0GK641 → OGK641. One or two
//     characters, same length, same shape, usually a known confusable pair.
//   • A RE-PLATE is a DIFFERENT plate entirely: 0GK641 → LZM500. A different string, and very often
//     a different province FORMAT — Alberta is digit-first, Manitoba is AAA999.
//
// ⚠️ Built on `confusableKey` and `plateShape` from lib/fleetAudit rather than a fresh
// implementation. Those already encode which characters a vision read swaps, they are already
// tested, and re-deriving that table here would be two definitions of one question — the exact
// defect that had `ticket_check` and `ticket_sweep` disagreeing about which repos use tickets.

export type PlateDifference =
  /** The tag and the record agree. */
  | 'same'
  /** Same plate, read badly — the record is right and must not be touched. */
  | 'misread'
  /** A different plate on the same car — the TAG is right and the record is stale. */
  | 'replate'
  /** Not enough to say (one side missing). */
  | 'unclear';

/**
 * ⚠️ ADVISORY ONLY. This never writes. Its whole job is to let the scan card ASK
 * ("new plates on this car?") in the one case where the record is the stale half — the forward-only
 * odometer and the plate-authoritative rule both exist because FG's default is to protect a good
 * record from a bad read, and that default stays.
 */
export function classifyPlateDifference(
  tagPlate?: string | null,
  recordPlate?: string | null,
): PlateDifference {
  const tag = normalizePlate(tagPlate);
  const record = normalizePlate(recordPlate);
  if (!tag || !record) return 'unclear';
  if (tag === record) return 'same';

  // Same plate once OCR confusion is collapsed (O↔0, I/L↔1, S↔5…). This is the 0GK641/OGK641 case
  // and it is unambiguously a bad read.
  if (confusableKey(tag) === confusableKey(record)) return 'misread';

  // ⚠️⚠️ A CLIPPED TAG, CHECKED BEFORE THE SHAPE RULE — and the ORDER is the entire fix.
  //
  // `FTR2260`'s tag was printed with the perforation through the left column, so the plate reads
  // `TR2260`. That is AA9999 against the record's AAA9999, so the rule below fired — the one whose
  // comment calls a format change "the strongest re-plate signal there is" — and FG offered
  // **"New plates — update"** on a plate Aaron had verified against the car's own barcode sticker
  // and the physical plate. One tap from overwriting a hand-verified record with a truncated read.
  //
  // ⭐ The shape rule is not wrong; it is INCOMPLETE. It reads a format change as a jurisdiction
  // change, and a dropped leading character is also a format change (AAA9999 → AA9999). Both
  // hypotheses explain the evidence, and only one of them is destructive — so the non-destructive
  // one is tested first, and only the residue reaches the shape rule.
  //
  // ⚠️ 'misread' is exactly the right word and not a euphemism: it already means "the record is
  // right and must not be touched", which is precisely true here. Measured on the live fleet the
  // day this shipped: NO plate's own one-character suffix is itself another live plate, so this
  // cannot swallow a real car. (`LUR271`/`KUR271` share a suffix as each other's tail, but neither
  // tail is a plate, so nothing here resolves to the wrong vehicle.)
  if (isLeadingTruncation(tag, record)) return 'misread';

  // ⭐ A different province FORMAT is the strongest re-plate signal there is. Alberta reads 9AA999,
  // Manitoba AAA999 — a read does not turn one into the other, but a trip to the plate office does.
  if (plateShape(tag) !== plateShape(record)) return 'replate';

  // Same shape, different characters. One position off is still a plausible read error even when the
  // characters are not a known confusable pair (LUR254 → LUR234 was exactly this, and it created a
  // duplicate record). Two or more is a different plate.
  const differing = [...tag].filter((c, i) => c !== record[i]).length;
  return differing <= 1 ? 'misread' : 'replate';
}

/** Should the scan card offer to adopt the tag's plate? Only for a re-plate — never a misread. */
export function shouldOfferPlateUpdate(tagPlate?: string | null, recordPlate?: string | null): boolean {
  return classifyPlateDifference(tagPlate, recordPlate) === 'replate';
}
