// Regression suite for the READER/WRITER PAIR class — a field FG persists that nobody can see, or
// one nobody can fill. Found by Aaron three times, in both directions:
//
//   2026-08-18  handoff_notes.photo_url  written on both shift logs, rendered by ONE
//   2026-08-25  vehicles.odometer        rendered on every record card, 0 of 683 rows — its only
//                                        writer was a surface that had not fired since Aug 5
//   2026-08-25  vehicles.vin_last9       column + scan capture + a 380-row backfill, displayed
//                                        NOWHERE (same day as the odometer, opposite direction)
//
// ⚠️ Every one was found by a HUMAN LOOKING AT A SCREEN. No gate could see them: the writes
// succeeded, the rows were correct, the types were sound, thousands of tests stayed green. A field
// with no reader is invisible precisely to the things that check correctness — which is why this
// has to be a census rather than an assertion about behaviour.
//
// The first occurrence produced `shift-log-photo-contract.test.ts` and that pattern works; it was
// simply scoped to photos on shift logs, so two vehicle columns walked straight past it. This is
// the same census, widened to every column on `vehicles`.
//
// ⚠️ WHAT THIS CANNOT DO, stated so the test never lies about its own reach: it cannot prove a
// writer is REACHABLE. The odometer HAD a writer (`recordOdometer`) with a real caller (the airport
// flip) — the caller just never fired. Source text sees a wired-up field; only usage or a live row
// count sees an empty column. So this catches write-with-no-read and read-with-no-writer-at-all,
// and is honestly blind to writer-that-never-runs.
//
// Source-text inspection like its four siblings — cheap, no render infrastructure, fails at the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/**
 * Columns that legitimately have no render site. Each needs a REASON, not just an entry — an
 * exemption without one is how a census turns into a permanent allowlist.
 */
const NOT_DISPLAYED: Record<string, string> = {
  updated_at: 'Row bookkeeping maintained by Supabase. It answers no question an operator asks; ' +
              'every "when did this change" surface reads the change log instead.',
};

/** Every column on `vehicles`, from the GENERATED types — so a new migration's column lands here
 *  automatically and has to be accounted for. A hand-maintained list would go stale silently,
 *  which is the exact failure mode that put MCN outside MB_PLATE_PREFIXES while 43 cars wore it. */
function vehicleColumns(): string[] {
  const types = readFileSync(join(ROOT, 'src/types/database.types.ts'), 'utf8');
  const start = types.indexOf('      vehicles: {');
  const row = types.slice(start, types.indexOf('Insert:', start));
  return [...row.matchAll(/^ {10}(\w+)\??:/gm)].map(m => m[1]);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

const componentSource = walk(join(ROOT, 'src/components'))
  .map(f => readFileSync(f, 'utf8'))
  .join('\n');

const camel = (col: string) => col.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());

/**
 * ⚠️ BOTH SPELLINGS, and that is not belt-and-braces — it is required.
 *
 * FG reads a column two ways: through `garage-mappers.ts` as camelCase (`vin_last9` → `vinLast9`),
 * and RAW snake_case in components that query Supabase directly — `VehicleEditApprovalSheet`
 * selects `edit_suggested_plate` and reads it under that name. A camelCase-only check reported
 * seven suggested-edit columns as orphaned when a whole approval sheet renders them. Do not
 * "simplify" this to one spelling; it produced a false accusation the first time it ran.
 */
function isDisplayed(col: string): boolean {
  const bounded = (s: string) => new RegExp(`\\b${s}\\b`).test(componentSource);
  return bounded(camel(col)) || bounded(col);
}

describe('vehicle field census: every stored column has somewhere to be seen', () => {
  it('CENSUS — no column is both undisplayed and undeclared', () => {
    const orphaned = vehicleColumns().filter(c => !isDisplayed(c) && !(c in NOT_DISPLAYED));
    expect(
      orphaned,
      `These \`vehicles\` columns are written but rendered nowhere in src/components.\n` +
      `Give each one a display, or declare it in NOT_DISPLAYED with the reason it has none.\n` +
      `(This is how vin_last9 shipped with a 380-row backfill and no reader.)`,
    ).toEqual([]);
  });

  it('the exemption list stays honest — a declared column that gained a display must be removed', () => {
    // Without this the census rots into an allowlist: a field exempted while genuinely invisible
    // stays exempted forever after someone gives it a screen, and the next orphan hides behind it.
    const nowVisible = Object.keys(NOT_DISPLAYED).filter(isDisplayed);
    expect(nowVisible, 'Now rendered somewhere — drop it from NOT_DISPLAYED.').toEqual([]);
  });

  it('every exemption carries a real reason, not a bare entry', () => {
    const thin = Object.entries(NOT_DISPLAYED).filter(([, why]) => why.trim().length < 40);
    expect(thin.map(([c]) => c), 'An exemption without a reason is an allowlist entry.').toEqual([]);
  });

  it('the column list is read from the generated types, and is not empty', () => {
    // Guards the extractor itself: if database.types.ts changes shape, the regex could silently
    // return [] and every assertion above would pass while checking nothing.
    const cols = vehicleColumns();
    expect(cols.length).toBeGreaterThan(30);
    expect(cols).toContain('vin_last9');
    expect(cols).toContain('odometer');
  });
});
