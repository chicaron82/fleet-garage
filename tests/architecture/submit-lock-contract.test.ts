// Regression suite for the Submit-Lock rule (see CLAUDE.md "Writing data").
//
// The contract: an INSERT-SHAPED write (one that mints a fresh row id) goes
// through `withSubmitLock(key, fn)` inside the context/hook write function —
// a React `submitting` flag only applies on the NEXT render, so a same-frame
// double-tap inserts two rows with two fresh UUIDs. The 2026-07-16 line-check
// found `addVehicle` unguarded while both its siblings were locked — "routes
// through a context write fn" FELT like inherited protection, but nothing
// verified the fn actually held the lock. The sweep that followed found FIVE
// more (markRepaired, markRepairedBatch, addRosterStaff, audit dispatch,
// effie-memory add, OTH backdate). This suite makes the class mechanical:
//
//  1. CENSUS — every `.insert(` site under src/context + src/hooks must be
//     accounted for in the manifest below. A new site fails the census until
//     it's classified (guarded, or exempted with a reason).
//  2. LOCK ASSERTIONS — each guarded write fn's source body must contain
//     `withSubmitLock(`. Removing/renaming a guard fails with a pointer.
//
// Like write-first-contract.test.ts, this is source-text inspection — cheap,
// no render infrastructure, and it fails at the exact file/function.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── 1. The census ─────────────────────────────────────────────────────────────
//
// file → expected `.insert(` site count. Add a line (with a comment saying
// whether the new site is locked or why it's exempt) when a new insert lands.
//
// Exempt-with-reason files (no lock required):
//  - evAssetWrite.ts: timeline append riding behind a keyed UPDATE that
//    converges; a dupe is a cosmetic history row, and the main callers sit
//    behind addVehicle's lock upstream.
//  - usePendingWrites.ts: payload carries a client id by contract; the drain
//    upserts on it, so a lost-ack retry converges instead of duplicating.
//  - useIssues.ts: 2 of 4 sites are inside the locked addIssue; the other 2
//    are issue_events appends behind converging status updates.
//  - useUnknownClassCode.ts: append-only telemetry (a class code the codex
//    couldn't resolve, logged so codes self-report). Every row is a sighting;
//    a duplicate sighting is a true record of two scans, not corruption, and
//    nothing reads it as a unique key. Fire-and-forget by design — a lock here
//    would add a failure mode to a path that must never disturb a scan.
//  - useRentalClasses.ts: the chip "Other" add. `code` is the PK, so a double-tap
//    can't mint two rows — it's a key conflict, and the hook swallows the
//    duplicate. Keyed-and-converges like usePendingWrites; a lock adds nothing.

const INSERT_CENSUS: Record<string, number> = {
  'src/context/ProfilesContext.tsx':    1, // addRosterStaff — locked
  'src/context/ScheduleContext.tsx':    1, // createShift/bulkCreateShifts — locked
  'src/context/evAssetLoanWrite.ts':    2, // createEvAssetLoan — locked; return leg converges
  'src/context/evAssetWrite.ts':        1, // EXEMPT: timeline append (see above)
  'src/context/holdResolution.ts':      2, // finalizeRepairedHold + batch — reached only via locked fns
  'src/context/holdWrite.ts':           2, // makeAddHold / makeAddRelease — locked
  'src/context/useIssues.ts':           4, // addIssue locked; 2 issue_events appends EXEMPT
  'src/context/useLostFound.ts':        1, // addLostFoundItem — locked
  'src/context/useVehicleOperations.ts':1, // addVehicle — locked
  'src/context/useWashbayHandoff.ts':   1, // submitHandoff — locked
  'src/hooks/useAudit.ts':              1, // handleDispatch — locked
  'src/hooks/useEffieMemory.ts':        1, // add — locked
  'src/hooks/useFuelPumpReadings.ts':   1, // locked (fuelreading day-key)
  'src/hooks/useOffStandardEntryEdits.ts': 1, // handleSubmitBackdate — locked
  'src/hooks/usePendingWrites.ts':      1, // EXEMPT: client-id keyed (see above)
  'src/hooks/useUnknownClassCode.ts':   1, // EXEMPT: append-only sighting log (see above)
  'src/hooks/useRentalClasses.ts':      1, // EXEMPT: chip "Other" add, PK-keyed on code (see above)
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('submit-lock census — every insert site is classified', () => {
  const roots = ['src/context', 'src/hooks'];
  const found: Record<string, number> = {};
  for (const root of roots) {
    for (const abs of walk(resolve(root))) {
      const rel = abs.slice(resolve('.').length + 1);
      const n = (readFileSync(abs, 'utf-8').match(/\.insert\(/g) ?? []).length;
      if (n > 0) found[rel] = n;
    }
  }

  it('no unclassified insert sites (new file or new site → classify it here)', () => {
    expect(
      found,
      'A `.insert(` site appeared that the manifest does not account for. ' +
      'If the write mints a fresh row id, wrap it in withSubmitLock inside the ' +
      'write fn (CLAUDE.md "Writing data"), then record it above — or document ' +
      'why it is exempt (keyed upsert / converging retry / timeline append).',
    ).toEqual(INSERT_CENSUS);
  });
});

// ── 2. Lock assertions on the guarded write fns ───────────────────────────────

interface GuardedFn { file: string; fn: string }

const GUARDED_FNS: GuardedFn[] = [
  { file: 'src/context/useVehicleOperations.ts',   fn: 'addVehicle' },
  { file: 'src/context/holdWrite.ts',              fn: 'makeAddHold' },
  { file: 'src/context/holdWrite.ts',              fn: 'makeAddRelease' },
  { file: 'src/context/holdResolution.ts',         fn: 'makeMarkRepaired' },
  { file: 'src/context/holdResolution.ts',         fn: 'makeMarkIssueRepaired' },
  { file: 'src/context/holdResolution.ts',         fn: 'makeMarkRepairedBatch' },
  { file: 'src/context/ProfilesContext.tsx',       fn: 'addRosterStaff' },
  { file: 'src/context/useIssues.ts',              fn: 'addIssue' },
  { file: 'src/context/useLostFound.ts',           fn: 'addLostFoundItem' },
  { file: 'src/context/ScheduleContext.tsx',       fn: 'createShift' },
  { file: 'src/context/ScheduleContext.tsx',       fn: 'bulkCreateShifts' },
  { file: 'src/context/useWashbayHandoff.ts',      fn: 'submitHandoff' },
  { file: 'src/context/evAssetLoanWrite.ts',       fn: 'createEvAssetLoan' },
  { file: 'src/hooks/useAudit.ts',                 fn: 'handleDispatch' },
  { file: 'src/hooks/useEffieMemory.ts',           fn: 'add' },
  { file: 'src/hooks/useOffStandardEntryEdits.ts', fn: 'handleSubmitBackdate' },
];

/** `const <fn> = …{…}` or `export function <fn>(…) {…}` body via brace counting
 *  (string/comment aware enough for these files — same approach as
 *  write-first-contract.test.ts, plus paren-depth tracking so a `{` inside a
 *  parameter list — a destructured deps object, an object type annotation —
 *  is never mistaken for the body's opening brace). For make* factories the
 *  body includes the returned closure, which is where the lock lives. */
function extractBody(source: string, fnName: string): string {
  const declRe = new RegExp(`(?:const\\s+${fnName}\\s*=|export function ${fnName}\\b)`);
  let start = source.search(declRe);
  if (start === -1) throw new Error(`Function ${fnName} not found in source`);
  // A `useCallback(` wrapper is transparent — scan from inside its paren so
  // the callback's own body brace still sits at paren-depth 0.
  const cb = source.slice(start).match(new RegExp(`${fnName}\\s*=\\s*useCallback\\s*\\(`));
  if (cb && cb.index !== undefined) start = start + cb.index + cb[0].length;
  // The body's `{` is the first one at paren-depth 0 after the declaration.
  let openBrace = -1;
  let pDepth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') pDepth++;
    else if (ch === ')') pDepth--;
    else if (ch === '{' && pDepth === 0) { openBrace = i; break; }
  }
  if (openBrace === -1) throw new Error(`No opening brace after ${fnName}`);
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let inLine = false, inBlock = false;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i], prev = source[i - 1];
    if (inLine)  { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '/' && prev === '*') inBlock = false; continue; }
    if (inString){ if (ch === inString && prev !== '\\') inString = null; continue; }
    if (ch === '/' && source[i + 1] === '/') { inLine = true;  continue; }
    if (ch === '/' && source[i + 1] === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return source.slice(openBrace, i + 1); }
  }
  throw new Error(`Unbalanced braces while scanning ${fnName}`);
}

describe('submit-lock contract — guarded write fns hold the lock', () => {
  describe.each(GUARDED_FNS)('$file::$fn', ({ file, fn }) => {
    it('contains withSubmitLock(', () => {
      const body = extractBody(readFileSync(resolve(file), 'utf-8'), fn);
      expect(
        /withSubmitLock\s*\(/.test(body),
        `${fn} is an insert-shaped write and must route through withSubmitLock — ` +
        'removing the guard reopens the same-frame double-submit window (two taps → two rows)',
      ).toBe(true);
    });
  });
});
