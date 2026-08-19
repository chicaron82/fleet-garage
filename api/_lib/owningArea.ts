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
};

/** FG's home branch. A car owned here is the unremarkable case; everything else is worth flagging. */
export const HOME_OWNING = '8199';

/** Digits only, leading zeros stripped — tags print it as "08199" or "8199". */
export function normalizeOwning(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 4 ? digits : '';
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
