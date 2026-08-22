// Auto-correcting a misread Manitoba plate. This location's MB-plated fleet
// uses a small known set of 3-letter prefixes, but handwriting mangles them on the
// daily inventory sheet and key tags — most often a hand-drawn U that reads as an M
// or N (KUR→KMR, LUR→LMR, LUR→LNR). A deterministic snap-to-known-prefix is a safety
// net UNDER the model's visual read: it can only turn a not-in-fleet prefix into a
// real one, never touch a prefix that's already valid or a foreign/out-of-province
// plate (VR…, SB…, OCC…, DBHJ…) whose prefix is nowhere near a known one.
//
// TWO passes, and the second one only runs once the first has PROVEN the plate is ours:
//   1. prefix — snap a one-character-off prefix to the known one (the U→M/N handwriting case)
//   2. body   — with a confirmed MB fleet prefix, the remaining three characters MUST be digits
//               (MB passenger plates are AAA111 — 518 of the 677 plates on record), so a letter
//               sitting in a digit position is a misread and gets snapped: LURL43 → LUR143.
//
// ⭐ Pass 2 is safe precisely BECAUSE pass 1 gates it. The known-prefix list is already the
// province signal — a foreign plate (VR…, SB…, OCC…, DBHJ…) never matches one, so its body is
// never touched. That gate is what lets this correct digits at all without a province table.
//
// Lives in api/_lib so both the Vercel fn (api/fg-chat) and client code can import it
// (client → api/_lib is allowed; the reverse isn't). Scoped to MB prefixes on purpose
// — Aaron's call, so foreign plates are never "corrected" toward an MB prefix.

/** The known Manitoba plate prefixes in this fleet. Extend as new prefixes appear.
 *  LFJ and LJF are BOTH real (a letter swap, not a typo) — two chars apart, so a read
 *  between them is ambiguous and left uncorrected rather than guessed. */
export const MB_PLATE_PREFIXES = ['LUR', 'KUR', 'LFJ', 'LJF', 'LZM'] as const;

/** Letters a vision read produces where a digit belongs.
 *
 *  ⚠️ THE ONE COPY. `src/lib/fleetAudit.ts` imports this rather than keeping its own — two
 *  hand-maintained confusable maps would drift the moment a new pair is added to one of them,
 *  and they'd disagree about the same plate. Deliberately TIGHT: every pair here either bit us
 *  or is a textbook confusion. A loose set would rewrite plates that were read correctly. */
export const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0',           // OEJ761 → 0EJ761 (real, 2026-05)
  I: '1', L: '1',   // LURL43 → LUR143 (real, 2026-07; the case that prompted pass 2)
  S: '5', B: '8', Z: '2', G: '6',
};

/** MB passenger plates are three letters then three digits. */
const MB_BODY_LEN = 3;

/** True when two equal-length strings differ in exactly one position. */
function oneCharOff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs++;
  return diffs === 1;
}

/** Pass 1 — snap a one-character-off prefix to the single known prefix it matches. Already-valid,
 *  ambiguous (one-off from TWO prefixes, e.g. LFF between LFJ and LJF), and unrelated prefixes are
 *  all left alone, so it never guesses and never touches a foreign plate. */
function snapPrefix(norm: string): string {
  const prefix = norm.slice(0, 3);
  if (prefix.length < 3 || (MB_PLATE_PREFIXES as readonly string[]).includes(prefix)) return norm;
  const hits = MB_PLATE_PREFIXES.filter((p) => oneCharOff(prefix, p));
  return hits.length === 1 ? hits[0] + norm.slice(3) : norm;
}

/**
 * Snap a misread MB plate to the real one — prefix first, then the digits behind it.
 *
 * Deterministic, pure, and it NEVER guesses:
 *  - a plate whose prefix isn't (or can't be snapped to) a known MB fleet prefix is returned
 *    untouched, body and all — that's what keeps foreign plates safe
 *  - the body is rewritten only if EVERY one of its three characters ends up a digit. A single
 *    unmappable letter (LURCAR) means we don't understand the plate, so we hand it back unchanged
 *    rather than emit something half-corrected that looks authoritative
 */
export function correctManitobaPlate(plate: string): string {
  const norm = snapPrefix(plate.trim().toUpperCase().replace(/\s+/g, ''));
  const prefix = norm.slice(0, 3);
  if (!(MB_PLATE_PREFIXES as readonly string[]).includes(prefix)) return norm;

  const body = norm.slice(3);
  if (body.length !== MB_BODY_LEN) return norm;   // not the AAA111 shape — leave it be

  const fixed = body.split('').map((c) => (/\d/.test(c) ? c : LETTER_TO_DIGIT[c] ?? c)).join('');
  return /^\d{3}$/.test(fixed) ? prefix + fixed : norm;
}
