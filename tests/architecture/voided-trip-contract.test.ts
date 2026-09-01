// Regression suite: every READ of `vsa_trips` must exclude voided rows.
//
// The contract, in Aaron's words (2026-09-01): *"I just need to know what was actually sent. not
// what planned on getting sent but then didn't."* A voided trip is one that DID NOT HAPPEN — a
// planned overflow send a driver never took. It must not appear in a manifest, a trip count, a
// shift report, an EV asset read, or anywhere else. `voided_at IS NULL` is not a preference; it
// is what makes the row a record of reality rather than of intention.
//
// ⚠️ WHY THIS IS A CONTRACT TEST AND NOT A CODE REVIEW NOTE. The filter is invisible today: every
// existing row has a null `voided_at`, so a query that forgets it behaves identically — until the
// first time he voids something, and then exactly one screen lies and nothing fails. That is the
// worst shape a defect can have, and it is the same shape as the stale comment in lib/sightings
// (`ab2e608`): a claim that was true when written, silently false later, with a green suite over
// the top of it. A textual contract is the only thing that catches a MISSING line.
//
// Source-text inspection, deliberately: there is no runtime in which "somebody added a new query
// six months from now" can be observed.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['src', 'api'];

/** The one file allowed to touch vsa_trips without a void filter: it WRITES. */
const WRITERS = new Set([
  'src/lib/vsaTripWrite.ts',      // insert / update / delete helper
  'src/hooks/useDriverLiveTrip.ts', // deletes an abandoned live trip by id
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

interface Offence { file: string; line: number; }

function findUnfilteredReads(): Offence[] {
  const offences: Offence[] = [];
  for (const d of SCAN_DIRS) {
    for (const abs of walk(join(ROOT, d))) {
      const rel = abs.slice(ROOT.length + 1);
      if (WRITERS.has(rel)) continue;
      const lines = readFileSync(abs, 'utf8').split('\n');
      lines.forEach((ln, i) => {
        if (!ln.includes("from('vsa_trips')")) return;
        // The filter may sit on the same line or in the chain that follows. A generous window:
        // a Supabase chain for one query is never longer than this before the next statement.
        const chain = lines.slice(i, i + 12).join('\n');
        if (chain.includes("'voided_at'")) return;
        offences.push({ file: rel, line: i + 1 });
      });
    }
  }
  return offences;
}

describe('every vsa_trips READ excludes voided rows', () => {
  it('has no query that would report a send that never happened', () => {
    const offences = findUnfilteredReads();
    expect(
      offences.map(o => `${o.file}:${o.line}`),
      'add .is(\'voided_at\', null) — a voided trip did not happen, so it must not be counted or listed',
    ).toEqual([]);
  });

  // ⚠️ A guard that guards nothing is worse than no guard: it reads as protection. If the scan
  // ever stops finding the queries at all (a rename, a query-builder refactor), this fails loudly
  // rather than passing vacuously — the same trap as the 23:30 shift-day fixture that would have
  // passed under either rule.
  it('is actually looking at the real queries — not passing because it found nothing', () => {
    let reads = 0;
    for (const d of SCAN_DIRS) {
      for (const abs of walk(join(ROOT, d))) {
        const rel = abs.slice(ROOT.length + 1);
        if (WRITERS.has(rel)) continue;
        reads += readFileSync(abs, 'utf8').split('\n').filter(l => l.includes("from('vsa_trips')")).length;
      }
    }
    expect(reads).toBeGreaterThanOrEqual(15);
  });
});
