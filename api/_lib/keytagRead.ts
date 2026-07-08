// The structured output of reading a Hertz key tag — what the (forthcoming) keytag
// vision endpoint extracts from a photo of the tag, sibling to fg-schedule-parse's
// document read. Every field is optional: a tag may be smudged, angled, or partial, and
// the resolver (src/lib/resolveKeytag) decides what a partial read means against the
// fleet. The field set mirrors NewVehicle (the register proposal) so a read flows
// straight into registration or backfill.
export interface KeytagRead {
  /** License plate — the match key. The caller normalizes (correctManitobaPrefix) and
   *  looks up an existing vehicle by this before resolving. */
  plate?: string;
  unitNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}
