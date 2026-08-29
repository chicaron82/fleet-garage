// The OWNING AREA — the branch that owns a vehicle, printed on every key tag and, until now,
// deliberately discarded.
//
// The tag's class line carries it: `WINNIPEG / 08199  Q4` printed, or `8199  B` handwritten. The
// reader's prompt said outright "report the short class code — NOT the branch number", so FG has
// never been able to tell a Winnipeg car from a Calgary one.
//
// Aaron, 2026-08-18:
//   8199 Winnipeg · 8191 Vancouver · 8193 Calgary · 8197 Toronto
//   *"sometimes we'll flip vehicles that were sent one way from a different location to MB plates.
//    the unit number stays the same but then will bear a MB plate."*
//
// ⚠️⚠️ WHY THIS IS CAPTURED AND NEVER DERIVED. The obvious shortcut is to infer the branch from the
// unit-number prefix — 542xxxx looks like Winnipeg, 57xxxx looks foreign. That inference is already
// wrong twice over:
//   • A FLIPPED car keeps its original unit AND owning and only changes plate, so a Calgary unit on
//     an MB plate is a real and normal state (three live in the fleet today).
//   • The numbers ROTATE. When Aaron started, Winnipeg's owning was 8999 with units 589xxxx and
//     592xxxx. It is now 8199 with 542xxxx — and 549xxxx was added when the branch outgrew one
//     prefix. Both the owning and the prefix list have already changed once in his tenure.
// So a prefix→branch table is a convention that silently rots, while the tag prints the truth on
// every single scan. Store what was read. Same reasoning as teaching the class codex instead of
// hardcoding it.

/** Owning codes Aaron has named. Used ONLY to put a friendly name beside a number — never to
 *  decide anything, and an unknown code is displayed as-is rather than guessed at. */
const KNOWN: Record<string, string> = {
  '8199': 'Winnipeg',
  '8191': 'Vancouver',
  '8193': 'Calgary',
  '8197': 'Toronto',
  // Winnipeg's owning BEFORE the renumber (Aaron's early years, units 589xxxx/592xxxx) — kept so
  // historical cars read as Winnipeg rather than as an unknown branch. Named plainly "Winnipeg":
  // the NUMBER already distinguishes it, and "Winnipeg (former) (8999)" reads like a stutter.
  '8999': 'Winnipeg',

  // Added 2026-08-21 — these three were live in the fleet and displaying as bare numbers.
  // Each was CONFIRMED, not guessed:
  //   8190 — all three cars carry 111AAA plates (Saskatchewan's format). Aaron called it.
  //   8194 — both cars carry AAA1111 plates (Quebec's format).
  //   8890 — read straight off two stored key tags: "VAN DTG / 08890". Vancouver, the
  //          Dollar/Thrifty side of it, which is why it sits alongside 8191. Named plainly
  //          "Vancouver" for the same reason 8999 is plainly "Winnipeg" — the number carries
  //          the distinction. Aaron called this one too; the PLATES had me doubting it (its
  //          five cars carry AB, MB and BC plates) until the tag settled it — those are
  //          long-stay 2022 Teslas re-plated where they sit, so a car's owning branch and its
  //          plate's province legitimately diverge. Don't infer a branch from plates.
  '8190': 'Saskatchewan',
  '8194': 'Montreal',
  '8890': 'Vancouver',

  // Added 2026-08-28 — CONFIRMED, not guessed, and confirmed by the artifact rather than by
  // inference. HNM262 was stored as 8199; Aaron opened its tag photo and read the city: *"the city
  // name is cutoff. halifax. definitely not winnipeg. so it wouldn't be 8199, it would be 8198."*
  // Its block-mate HMT717 already carried 8198, so the unit prefix agreed with him independently.
  '8198': 'Halifax',
};

// ⚠️ STILL UNNAMED, deliberately: 8892, and 2294 (the US branch on the Florida Compass). Neither has
// been confirmed by Aaron and neither is guessable — this map's whole rule is that an entry is
// confirmed or absent, and an unknown code displays as a bare number rather than a wrong name.

/** ⚠️ WHY 8199 SWAMPS EVERYTHING, and why that is permanent. Aaron, 2026-08-28: *"8199 is the
 *  dominant owning because.. well we're in manitoba haha of course our fleet will be mainly MB
 *  vehicles. any out of province cars we have came here via one way and just happened to stay."*
 *  284 of 365 — seven to one — and it will stay that way for as long as FG runs in Winnipeg.
 *
 *  ⭐ The consequence is load-bearing for anything that reasons about owning areas: a
 *  single-character misread TOWARD 8199 hides inside the majority. Three were found on 2026-08-28,
 *  all invisible for the same reason (8193→8199 is 3↔9; 8198→8199 is 8↔9), and every one was caught
 *  by a human reading the tag rather than by any check over the data. **No frequency-based check
 *  can catch this** — see docs/ticket-the-tag-is-a-redundant-document.md. */

/** FG's home branch. A car owned here is the unremarkable case; everything else is worth flagging. */
export const HOME_OWNING = '8199';

/** Digits only, leading zeros stripped — tags print it as "08199" or "8199". */
export function normalizeOwning(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 4 ? digits : '';
}

/** City name → every owning number that carries it. DERIVED from KNOWN rather than hand-written,
 *  because two maps of the same fact drift: Winnipeg is both 8199 and 8999 (the pre-renumber
 *  number), Vancouver is both 8191 and 8890. A second hand-maintained table would have to be
 *  remembered on every future rename. */
const CITY_TO_OWNINGS: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [num, name] of Object.entries(KNOWN)) {
    const key = name.trim().toUpperCase();
    const list = m.get(key);
    if (list) list.push(num); else m.set(key, [num]);
  }
  return m;
})();

/** What the tag's city line says about the tag's owning number. */
export type OwningCityCheck =
  | { kind: 'agree'; city: string; owningArea: string }
  /** The city is one FG knows and the number belongs to a DIFFERENT branch. Surfaced, never
   *  auto-corrected: the tag carries both halves and only a person should decide which half won. */
  | { kind: 'conflict'; city: string; owningArea: string; expected: readonly string[] }
  /** Either half missing, or a city string FG has no name for. NOT a disagreement. */
  | { kind: 'unknown' };

/**
 * Cross-check the two halves of a key tag's top line.
 *
 * ⭐⭐ WHY THIS EXISTS. On 2026-08-28 Aaron read three stored tags and found three owning areas
 * wrong: a HALIFAX tag stored as 8199, and two CALGARY tags stored as 8199. Every one is a
 * single-character misread (8198→8199 is 8↔9; 8193→8199 is 3↔9) landing on the fleet's dominant
 * value — 284 of 365, seven to one, and structurally permanent because the branch is in Manitoba.
 *
 * ⭐⭐⭐ Which is exactly why no check that reasons from FREQUENCY can catch this class of error: a
 * misread toward the majority is one more vote FOR the majority. The city is the only independent
 * evidence on the tag, and FG has been reading that line and discarding half of it — the same thing
 * it did with the owning number itself until 2026-08-18.
 *
 * ⚠️ AND THE COMPOUNDING DETAIL: on the Halifax tag the city name was CUT OFF. The condition that
 * damages one field is often the condition that makes the other worth reading.
 *
 * ⚠️ UNKNOWN IS NEVER DISAGREEMENT. A city FG has no name for is a new branch, not a conflict —
 * the 8890 tags print "VAN DTG", which is not the string "Vancouver" and must never be flagged.
 * KNOWN is built by confirming entries with Aaron, one at a time, and this inherits that discipline.
 */
export function checkOwningCity(
  rawCity: string | null | undefined,
  rawOwning: string | null | undefined,
): OwningCityCheck {
  const city = (rawCity ?? '').trim().toUpperCase();
  const owningArea = normalizeOwning(rawOwning);
  if (!city || !owningArea) return { kind: 'unknown' };

  const expected = CITY_TO_OWNINGS.get(city);
  if (!expected) return { kind: 'unknown' };          // a city FG cannot name is not a contradiction
  if (expected.includes(owningArea)) return { kind: 'agree', city, owningArea };
  return { kind: 'conflict', city, owningArea, expected };
}

/** "Calgary (8193)" when known, "8193" when not, '' when absent. Never guesses a branch name. */
export function owningLabel(raw: string | null | undefined): string {
  const o = normalizeOwning(raw);
  if (!o) return '';
  const name = KNOWN[o];
  return name ? `${name} (${o})` : o;
}

/**
 * Is this car owned by another branch — i.e. worth saying out loud?
 *
 * A Winnipeg car reading 8199 is noise on every scan. A car reading 8193 is a Calgary unit sitting
 * in his bay, which is the whole reason the field is worth capturing: it's the input to the
 * keep-and-reflip decision. Unknown/absent owning is NOT foreign — most of the fleet predates this
 * capture and will read empty for a long time.
 */
export function isForeignOwning(raw: string | null | undefined): boolean {
  const o = normalizeOwning(raw);
  if (!o) return false;
  return o !== HOME_OWNING && o !== '8999';
}

// ── The plate shape a branch's own cars wear ────────────────────────────────────────────────────
// Added 2026-08-22 for the plate ↔ owning cross-check (docs/ticket-plate-province-crosscheck.md).
//
// ⚠️ MEASURED, NOT RECALLED. Every shape below was computed from the live fleet on 2026-08-22 by
// collapsing each plate to letters-and-digits and grouping by owning code:
//   8199 Winnipeg   AAA999   (112 cars, unanimous)
//   8193 Calgary    9AA999   (12)
//   8197 Toronto    AAAA999  (4)
//   8191 Vancouver  AA999A   (3)
//   8190 Sask.      999AAA   (3)
//   8194 Montreal   AAA9999  (2)
// All six are DISTINCT, which is what makes a mismatch meaningful rather than ambiguous. An earlier
// version of this knowledge lived only in my head and I got a province wrong from it; the numbers
// above are reproducible from the vehicles table.
//
// 8890 is deliberately absent even though it is a known branch: its five cars carry MB, AB and BC
// plates, because they are long-stay Teslas re-plated where they sit. A branch whose own fleet
// disagrees about its format cannot vouch for a plate, and inventing one for it would flag four
// correct cars. Same for 8999 (historical Winnipeg) — no live cars to measure.

/** Owning code → the plate shape that branch's own cars wear, in A(letter)/9(digit) form. */
const OWNING_PLATE_SHAPE: Record<string, string> = {
  '8199': 'AAA999',    // Manitoba
  '8193': '9AA999',    // Alberta
  '8197': 'AAAA999',   // Ontario
  '8191': 'AA999A',    // British Columbia
  '8190': '999AAA',    // Saskatchewan
  '8194': 'AAA9999',   // Quebec
};

/** The shape a car owned by `raw` should wear, or '' when this branch cannot vouch for one. */
export function expectedPlateShape(raw: string | null | undefined): string {
  return OWNING_PLATE_SHAPE[normalizeOwning(raw)] ?? '';
}
