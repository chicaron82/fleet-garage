// Reading a hold's own note and proposing which panels it means.
//
// ⭐ IT IS NOT INVENTING DATA — IT IS READING HIS. 101 of 441 holds already say where the damage is,
// in the notes, in Aaron's own hand: "Rear driver door ding", "Pass. Side Mirror missing cover",
// "Lift gate dents", "Front passenger rim rash". The location has been recorded all along as prose
// nothing could query. This turns 441 rows of manual tagging into a fast confirm-or-correct pass.
//
// ⚠️⚠️ IT PROPOSES CANDIDATES AND SELECTS NOTHING. The rule is the same one the plate ↔ owning check
// cost me: when a machine cannot be sure, surfacing the choice IS the feature. A pre-selected wrong
// guess he taps straight past would write bad data into the exact history this is meant to make
// trustworthy — and "Driver door ding" genuinely does not say front or rear. Light both. He picks.
//
// The vocabulary below is MEASURED, not imagined: every synonym here appears in a live hold note
// (read 2026-08-22), including "ws" for windshield, "rim rash", "hubcap", "wheel cap", "side skirt",
// and RIGHT/LEFT used interchangeably with passenger/driver.
import { DAMAGE_ZONE_IDS, orderZones } from './damageZones';

type Side = 'driver' | 'passenger';
type Position = 'front' | 'rear';

/** More than this and the map lights up like a christmas tree, which helps nobody — a note too
 *  vague to narrow the car is better answered with no suggestion than with half of it. */
const MAX_CANDIDATES = 6;

/** Word → the side of the car. LEFT/RIGHT are his too ("Right rear fender and door"); in Canada
 *  the driver sits on the left, so left=driver and right=passenger. */
const SIDE_PATTERNS: ReadonlyArray<readonly [RegExp, Side]> = [
  [/\bdriver'?s?\b|\bdriverside\b|\bleft\b|\blh\b/, 'driver'],
  [/\bpassenger'?s?\b|\bpass\.?\b|\bright\b|\brh\b/, 'passenger'],
];

const POSITION_PATTERNS: ReadonlyArray<readonly [RegExp, Position]> = [
  [/\bfront\b|\bfwd\b/, 'front'],
  [/\brear\b|\bback\b/, 'rear'],
];

/** A part, and how it becomes zone ids once the sides/positions in the note are applied.
 *  Order matters only for readability — every match contributes. */
const PARTS: ReadonlyArray<{
  re: RegExp;
  zones: (sides: Side[], positions: Position[]) => string[];
}> = [
  // Centre-line parts: one zone, no side, position only where the car has two of them.
  { re: /\bhood\b|\bbonnet\b/,                     zones: () => ['hood'] },
  { re: /\broof\b/,                                zones: () => ['roof'] },
  { re: /\bwindshield\b|\bwindscreen\b|\bws\b/,    zones: () => ['windshield'] },
  { re: /\brear glass\b|\bback glass\b|\brear window\b/, zones: () => ['rear-glass'] },
  { re: /\btrunk\b|\blift ?gate\b|\btail ?gate\b|\bhatch\b/, zones: () => ['trunk-liftgate'] },
  { re: /\bbumper\b/, zones: (_s, p) => pick(p, ['front', 'rear']).map(x => `${x}-bumper`) },

  // Side parts: one per side, and doors/quarters also per position.
  { re: /\bdoor(s)?\b/,           zones: (s, p) => cross(s, p, (side, pos) => `${side}-${pos}-door`) },
  { re: /\bquarter\b|\bfender\b/, zones: (s, p) => cross(s, p, (side, pos) => `${side}-${pos}-quarter`) },
  { re: /\bmirror\b/,             zones: (s) => pick(s, ['driver', 'passenger']).map(x => `mirror-${x}`) },
  { re: /\bwheel\b|\brim\b|\bhub ?cap\b|\bwheel cap\b|\btire\b|\btyre\b/,
    zones: (s, p) => cross(s, p, (side, pos) => `wheel-${side}-${pos}`) },
  { re: /\bskirt\b|\brocker\b|\bsill\b/, zones: (s) => pick(s, ['driver', 'passenger']).map(x => `rocker-${x}`) },
];

/** What the note named, or every option when it named none — an unstated side means BOTH are
 *  candidates, never a coin flip. */
function pick<T>(found: readonly T[], all: readonly T[]): T[] {
  return found.length > 0 ? [...found] : [...all];
}

function cross(sides: Side[], positions: Position[], make: (s: Side, p: Position) => string): string[] {
  const out: string[] = [];
  for (const s of pick(sides, ['driver', 'passenger'] as const)) {
    for (const p of pick(positions, ['front', 'rear'] as const)) out.push(make(s, p));
  }
  return out;
}

const KNOWN = new Set<string>(DAMAGE_ZONE_IDS);

export interface NoteZoneGuess {
  /** Panels the note could be describing. Never auto-applied — the UI lights them, he confirms. */
  candidates: string[];
  /** True when the note pinned exactly one panel. Still not applied; it just reads with confidence. */
  certain: boolean;
}

/**
 * Read a hold note and propose the panels it describes.
 *
 * Returns an EMPTY list rather than a bad guess when the note says nothing useful ("Various dents
 * and scratches"), or so much that the whole car lights up. Silence is a valid answer here — the
 * fallback is him looking at the photo, which was always going to be the source of truth.
 */
export function zonesFromNote(note: string | null | undefined): NoteZoneGuess {
  const text = (note ?? '').toLowerCase();
  if (!text.trim()) return { candidates: [], certain: false };

  const sides = SIDE_PATTERNS.filter(([re]) => re.test(text)).map(([, s]) => s);
  const positions = POSITION_PATTERNS.filter(([re]) => re.test(text)).map(([, p]) => p);

  const named = PARTS.filter(p => p.re.test(text));
  let out = named.flatMap(p => p.zones(sides, positions)).filter(z => KNOWN.has(z));

  // A note that names a SIDE but no part still narrows the car — by half, or by a quarter when it
  // also says front/rear ("Rear passenger", "Chip driver side"). Offer that side's body panels, not
  // its wheels or mirror, which he would have named if he meant them.
  //
  // ⚠️ It also fires when the note DID name parts but none of them sit on the side he mentioned —
  // "Various dents and scratches on driver side and lift gate" describes TWO things, and answering
  // only "lift gate" is worse than answering nothing: a partial suggestion looks complete, so he
  // confirms it and the driver-side damage is quietly lost. Completeness or silence, never half.
  //
  // ⚠️ And it must NOT fire on a centre-line part that merely got a side word for flavour: "Front
  // right bumper scratch" is one damage on one bumper, not a bumper plus half the passenger side.
  // The tell is a conjunction — a note describing two things says "and", or uses a comma or slash.
  const conjunction = /\band\b|,|\//.test(text);
  if (sides.length === 1 && (named.length === 0 || conjunction)) {
    const s = sides[0];
    const onThatSide = out.some(z => z.includes(s));   // wheel-driver-front has it in the MIDDLE
    if (!onThatSide) {
      const rows = pick(positions, ['front', 'rear'] as const);
      out = [...out, ...rows.flatMap(p => [`${s}-${p}-quarter`, `${s}-${p}-door`])];
    }
  }

  // A note that names only an END of the car — "Rear scratches", "Front trim", "Front" — still
  // halves it. Offer that end's centre-line panels; anything on a side he would have said a side for.
  // (Found by running this over all 251 standing untagged notes rather than over cases I invented.)
  if (named.length === 0 && sides.length === 0 && positions.length === 1) {
    out = positions[0] === 'front' ? ['front-bumper', 'hood'] : ['rear-bumper', 'trunk-liftgate'];
  }

  const candidates = orderZones(out);
  if (candidates.length === 0 || candidates.length > MAX_CANDIDATES) {
    return { candidates: [], certain: false };
  }
  return { candidates, certain: candidates.length === 1 };
}
