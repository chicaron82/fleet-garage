// Auto-correcting a misread Manitoba plate prefix. This location's MB-plated fleet
// uses a small known set of 3-letter prefixes, but handwriting mangles them on the
// daily inventory sheet and key tags — most often a hand-drawn U that reads as an M
// or N (KUR→KMR, LUR→LMR, LUR→LNR). A deterministic snap-to-known-prefix is a safety
// net UNDER the model's visual read: it can only turn a not-in-fleet prefix into a
// real one, never touch a prefix that's already valid or a foreign/out-of-province
// plate (VR…, SB…, OCC…, DBHJ…) whose prefix is nowhere near a known one.
//
// Lives in api/_lib so both the Vercel fn (api/fg-chat) and client code can import it
// (client → api/_lib is allowed; the reverse isn't). Scoped to MB prefixes on purpose
// — Aaron's call, so foreign plates are never "corrected" toward an MB prefix.

/** The known Manitoba plate prefixes in this fleet. Extend as new prefixes appear. */
export const MB_PLATE_PREFIXES = ['LUR', 'KUR', 'LFJ', 'LZM'] as const;

/** True when two equal-length strings differ in exactly one position. */
function oneCharOff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs++;
  return diffs === 1;
}

/**
 * Snap a misread MB plate prefix to the known one. If the leading 3 letters aren't
 * already a known prefix but are exactly one character off from EXACTLY ONE known
 * prefix, correct to it (the rest of the plate is untouched). Already-valid,
 * ambiguous (one-off from two prefixes), and unrelated prefixes are left as-is —
 * so it never guesses and never touches a foreign plate. Deterministic and pure.
 */
export function correctManitobaPrefix(plate: string): string {
  const norm = plate.trim().toUpperCase().replace(/\s+/g, '');
  const prefix = norm.slice(0, 3);
  if (prefix.length < 3 || (MB_PLATE_PREFIXES as readonly string[]).includes(prefix)) return norm;
  const hits = MB_PLATE_PREFIXES.filter((p) => oneCharOff(prefix, p));
  return hits.length === 1 ? hits[0] + norm.slice(3) : norm;
}
