// Regression suite: every renderer of an odometer states the UNIT it is in.
//
// ⚠️⚠️ THIS DEFECT HAS RECURRED FOUR TIMES, which is why it is a contract and not a code review.
//   1. 2026-08-27 — FG met its first US car. The record CHIP learned "mi"; the input control
//      beside it still said "km on the dash".
//   2. …and the control was fixed only because Aaron read the Jeep's record at 23,175 MILES with a
//      box under it asking for kilometres.
//   3. 2026-08-31 — `checkOdometerJump` was written the day AFTER that, and hardcoded km anyway:
//      it compared a mileage delta against a km/day ceiling AND printed "km" over the number.
//   4. 2026-09-01 — the airport flip's "last recorded" line, found by sweeping when Aaron said
//      "FG now has 2 US plated vehicles". It would have labelled the Jeep's miles as kilometres on
//      the very screen where the counter is told a car's mileage.
//
// Every one was the same move: fix the reader you are looking at, miss the one beside it. Both
// functions DEFAULT to km — correct for all but a handful of cars, and therefore silent on exactly
// the cars that are wrong. A default that is usually right is precisely what a textual contract is
// for: nothing fails, nothing renders red, the number just quietly means something else.
//
// The rule: a call to `describeOdometer` or `checkOdometerJump` outside the lib itself must pass
// the unit argument. `odometerUnitFor(isUs)` is how you get one.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');
const SELF = 'src/lib/odometer.ts';   // the definitions themselves, and their own defaults

/** describeOdometer(value, at, now, UNIT) · checkOdometerJump(incoming, stored, at, now, UNIT) */
const ARITY: Record<string, number> = { describeOdometer: 4, checkOdometerJump: 5 };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Count top-level commas in a call's argument list, respecting nesting and template strings. */
function argCount(args: string): number {
  let depth = 0, n = 1, seen = false;
  for (const ch of args) {
    if ('([{`'.includes(ch)) depth++;
    else if (')]}`'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) n++;
    if (!/\s/.test(ch)) seen = true;
  }
  return seen ? n : 0;
}

interface Offence { file: string; line: number; fn: string; args: number }

function findUnitlessCalls(): { offences: Offence[]; calls: number } {
  const offences: Offence[] = [];
  let calls = 0;
  for (const abs of walk(SRC)) {
    const rel = abs.slice(ROOT.length + 1);
    if (rel === SELF) continue;
    const text = readFileSync(abs, 'utf8');
    for (const fn of Object.keys(ARITY)) {
      const re = new RegExp(`\\b${fn}\\(`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        // Skip a mention inside a comment line — those are prose, not calls.
        const lineStart = text.lastIndexOf('\n', m.index) + 1;
        const before = text.slice(lineStart, m.index);
        if (/^\s*(\/\/|\*|\/\*)/.test(before)) continue;
        // Walk to the matching close paren.
        let depth = 0, i = m.index + fn.length;
        for (; i < text.length; i++) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') { depth--; if (depth === 0) break; }
        }
        calls++;
        const args = argCount(text.slice(m.index + fn.length + 1, i));
        if (args < ARITY[fn]) {
          offences.push({ file: rel, line: text.slice(0, m.index).split('\n').length, fn, args });
        }
      }
    }
  }
  return { offences, calls };
}

describe('every odometer reader states its unit', () => {
  it('has no call that silently defaults to kilometres', () => {
    const { offences } = findUnitlessCalls();
    expect(
      offences.map(o => `${o.file}:${o.line} ${o.fn}() got ${o.args} args`),
      'pass the unit — odometerUnitFor(isUs). A US car reads MILES, and the default is silent.',
    ).toEqual([]);
  });

  // ⚠️ A guard that guards nothing is worse than no guard. If the scan ever stops finding the calls
  // (a rename, a wrapper), this fails loudly rather than passing vacuously.
  it('is actually finding the calls — not passing because it found none', () => {
    expect(findUnitlessCalls().calls).toBeGreaterThanOrEqual(4);
  });
});
