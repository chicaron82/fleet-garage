// The structured output of reading a Hertz key tag — what the (forthcoming) keytag
// vision endpoint extracts from a photo of the tag, sibling to fg-schedule-parse's
// document read. Every field is optional: a tag may be smudged, angled, or partial, and
// the resolver (src/lib/resolveKeytag) decides what a partial read means against the
// fleet. The field set mirrors NewVehicle (the register proposal) so a read flows
// straight into registration or backfill.
export interface KeytagRead {
  /** License plate ("Lic Plate") — the match key. The caller normalizes
   *  (correctManitobaPrefix) and looks up an existing vehicle by this before resolving. */
  plate?: string;
  /** "Veh #", digit groups joined (e.g. "542 0427" → "5420427"). */
  unitNumber?: string;
  /** The class-line code (e.g. "CCVL"). make/model are DERIVED from this via a fleet
   *  class lookup — they are not printed on the tag, so the raw read leaves them empty
   *  and a downstream class-resolution step fills them in. */
  classCode?: string;
  make?: string;
  model?: string;
  /** Model year — the trailing number on the class line ("CCVL 25" → 2025). */
  year?: number;
  /** Colour, mapped from the tag's colour code (WHI→White, BLK→Black, …). */
  color?: string;
  /** Body style off the colour/body line (e.g. "4DR"). Informational; not resolved. */
  bodyStyle?: string;
}
