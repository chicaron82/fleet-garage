// The structured output of reading a Hertz key tag — what the (forthcoming) keytag
// vision endpoint extracts from a photo of the tag, sibling to fg-schedule-parse's
// document read. Every field is optional: a tag may be smudged, angled, or partial, and
// the resolver (src/lib/resolveKeytag) decides what a partial read means against the
// fleet. The field set mirrors NewVehicle (the register proposal) so a read flows
// straight into registration or backfill.
export interface KeytagRead {
  /** The OWNING branch number off the tag's top line ("8199" Winnipeg, "8193" Calgary…),
   *  normalized to digits without the printed leading zero. Undefined when not legible.
   *  Captured 2026-08-18 — the line was always read and the number always discarded. */
  owningArea?: string;
  /** License plate ("Lic Plate") — the match key. The caller normalizes
   *  (correctManitobaPlate) and looks up an existing vehicle by this before resolving. */
  plate?: string;
  /** "Veh #", digit groups joined (e.g. "542 0427" → "5420427"). */
  unitNumber?: string;
  /** The nine characters after "Last9vin:" on a printed tag. NOT a full VIN — no manufacturer,
   *  plant or model-year digits are present, so nothing may be decoded from it.
   *
   *  ⚠️ THIS USED TO CLAIM IT IS "the one key that survives a re-plate". IT IS NOT, and the claim
   *  misdescribes the job. Aaron, 2026-08-26: *"everything on that keytag survives. the only change
   *  is the plate."* A re-plated car keeps its unit number, its VIN, its class code, its colour and
   *  its options — it crosses provinces carrying every field but one. Five of the six things on that
   *  tag survive, so surviving is not what makes this field special.
   *
   *  ⭐ What actually makes it the strongest key: it is the only one that is BOTH PERMANENT AND
   *  UNIQUE. The plate is unique but does not survive a re-plate. The unit number survives and is
   *  unique across the live fleet, but it is a fleet-assignment number rather than a property of the
   *  physical car. The VIN is stamped on the vehicle itself and never changes. (migration 126) */
  vinLast9?: string;
  /** The class-line code (e.g. "CCVL"). make/model are DERIVED from this via a fleet
   *  class lookup — they are not printed on the tag, so the raw read leaves them empty
   *  and a downstream class-resolution step fills them in. */
  classCode?: string;
  /** The RENTAL CLASS — the short size/type group code printed by the branch number up top
   *  (e.g. "Q4", "P4", "T", "L2"). Distinct from classCode: read straight off the tag (not
   *  derived), a car GROUP many models share, and the shorthand the boss uses to request
   *  returns. Upper-cased. Empty if not legible. */
  rentalClass?: string;
  /** Set when `rentalClass` above was NOT read off the tag but INFERRED from the class code via the
   *  learned code→class store (`class_code_rental_class`): the tag's class field was unreadable, but
   *  the code resolved to a class FG learned from a prior clean scan. The register form marks the
   *  field 'inferred' (a later clean tag read outranks + self-corrects it) and flags it to the
   *  operator. Absent/false = read straight off the tag. */
  rentalClassInferred?: boolean;
  /** Set when `rentalClass` came from a PINNED code→class mapping — a person decided it, and the
   *  scan is forbidden from re-teaching over it (migration 127). Outranks both the tag and any
   *  learned value. `CRHX` is the first: the tag prints Q4, the real class is E6, and every scan
   *  used to un-teach the correction. */
  rentalClassPinned?: boolean;
  /** What the TAG said, when a pin overrode it and the two disagree. Kept so the surface can show
   *  "E6 · pinned (tag says Q4)" instead of silently rewriting the artifact — FG's rule is that
   *  when two signals disagree you surface it, never lean. Absent when they agree. */
  rentalClassOnTag?: string;
  make?: string;
  model?: string;
  /** Hybrid — set when the resolved class code is a hybrid variant (the codex's isHybrid hint,
   *  e.g. CCMH/CCLH/CRHX/CSEH). Lets a scanned hybrid tag pre-check the register form's toggle
   *  instead of registering as gas + waiting for a manual tick. */
  isHybrid?: boolean;
  /** Model year — the trailing number on the class line ("CCVL 25" → 2025). */
  year?: number;
  /** Colour, mapped from the tag's colour code (WHI→White, BLK→Black, …). */
  color?: string;
  /** Body style off the colour/body line (e.g. "4DR"). Informational; not resolved. */
  bodyStyle?: string;
}
