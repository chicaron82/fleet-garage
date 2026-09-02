// Regression suite: nobody hand-writes a vehicle's name.
//
// ⚠️⚠️ THIS IS THE THIRD TIME. `lib/vehicleName` was created because `{v.year} {v.make} {v.model}`
// was hand-written in EIGHT files while the powertrain badge lived in exactly one — *"which is why
// he had never once seen it on a vehicle record"*. The component shipped. **The callers it was
// written for were never converted.**
//
// So on 2026-09-01 Aaron lined up three screens of one 2026 Honda Civic: the audit card said
// "2026 Honda Civic 🔋", and the vehicle record and the scan sheet — the two places you decide what
// a car IS — said "2026 Honda Civic". `is_hybrid` was true the whole time.
//
// ⭐ A hand-written name never fails. It renders perfectly; it just quietly omits the one mark that
// distinguishes a hybrid Sportage from the petrol one. Nothing errors, no test goes red, and the
// only way it surfaces is a person noticing two screens disagree. That is precisely the shape a
// textual contract exists for.
//
// The rule is NOT "always show a badge" — it is "make the choice in one place":
//   • he READS it on a screen   → <VehicleName> / vehicleNameText   (badge)
//   • stored, exported, compared → vehicleLabel                     (no badge)
// Both live in lib/vehicleName. Hand-assembling the string is what is banned.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');
/** The definitions themselves — the one place the parts are legitimately assembled. */
const ALLOWED = new Set(['src/lib/vehicleName.ts']);

/** `{a.year} {a.make}` · `${a.year} ${a.make}` · `[a.year, a.make, …]` — the three shapes it has
 *  actually taken in this codebase. */
const PATTERNS: RegExp[] = [
  /\{[A-Za-z_$][\w$.]*\.year\}\s*\{[A-Za-z_$][\w$.]*\.make\}/,
  /\$\{[A-Za-z_$][\w$.]*\.year\}\s*\$\{[A-Za-z_$][\w$.]*\.make\}/,
  /\[\s*[A-Za-z_$][\w$.]*\.year\s*,\s*[A-Za-z_$][\w$.]*\.make\b/,
];

// ⚠️ EVERY PATTERN ANCHORS ON THE YEAR, and that is a deliberate narrowing rather than a gap.
// A bare `${x.make} ${x.model}` is NOT this defect — it is how the codex explains a CLASS CODE
// ("CHCS → Honda Civic"), and how a search haystack is built. Those describe a model family, not a
// specific car: there is no vehicle, so there is no badge to lose. A year is what makes a string
// an identity line, and an identity line is the only thing that can silently drop the ⚡/🔋.
//
// ⭐ Narrowed rather than exempted, on purpose. Three files would have needed an allowlist entry,
// and an allowlist is where a REAL identity line eventually hides — "it was already in the list".
// A rule that describes the defect precisely needs no exceptions to maintain.

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function findHandWritten(): string[] {
  const hits: string[] = [];
  for (const abs of walk(SRC)) {
    const rel = abs.slice(ROOT.length + 1);
    if (ALLOWED.has(rel)) continue;
    readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
      // Prose in a comment is allowed to quote the pattern — several of these files explain it.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (PATTERNS.some(re => re.test(line))) hits.push(`${rel}:${i + 1}`);
    });
  }
  return hits;
}

describe('a vehicle name comes from lib/vehicleName', () => {
  it('is never assembled by hand', () => {
    expect(
      findHandWritten(),
      'use <VehicleName> / vehicleNameText where he reads it, vehicleLabel where it is stored, exported or compared',
    ).toEqual([]);
  });

  // ⚠️ A guard that guards nothing is worse than none. If the patterns ever stop matching the
  // codebase's real shapes, this fails loudly instead of passing on an empty scan.
  it('still recognises a hand-written name when it sees one', () => {
    const sample = "<p>{vehicle.year} {vehicle.make} {vehicle.model}</p>";
    expect(PATTERNS.some(re => re.test(sample))).toBe(true);
    const template = "`${v.year} ${v.make} ${v.model}`";
    expect(PATTERNS.some(re => re.test(template))).toBe(true);
    const joined = "[m.year, m.make, m.model].filter(Boolean).join(' ')";
    expect(PATTERNS.some(re => re.test(joined))).toBe(true);
  });

  // ⚠️ And it must NOT fire on the things that merely look similar — a class-code lesson and a
  // search haystack. If this ever goes red, the pattern has widened past the defect and will start
  // demanding exemptions, which is how the rule dies.
  it('leaves a class-code lesson and a search haystack alone', () => {
    const lesson = "`${normalizeClassCode(code)} → ${known.make} ${known.model}.`";
    const haystack = "`${v.unitNumber ?? ''} ${v.licensePlate} ${v.make} ${v.model}`.toLowerCase()";
    for (const s of [lesson, haystack]) expect(PATTERNS.some(re => re.test(s))).toBe(false);
  });
});
