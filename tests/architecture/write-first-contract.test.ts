// Regression suite for the Write-First Pattern (see ARCHITECTURE.md).
//
// The contract: in any "start a timed session" handler, the Supabase insert
// must be awaited and its error checked BEFORE any state setter marks the
// session as live (id setter, departure timestamp, state-machine flip).
//
// This is a source-text inspection, not a runtime test. Past regressions have
// happened during refactors that re-ordered setState/await within these
// handlers; a textual ordering check catches that class of bug without
// needing component-render infrastructure (no jsdom, no testing-library).
//
// If a future handler refactor moves a session-marker setter above the
// awaited insert, this suite fails with a precise pointer to the offending
// file and setter.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ReferenceImpl {
  /** Repo-relative path. */
  file: string;
  /** Function declaration name inside the file (e.g. `handleStartWith`). */
  fn: string;
  /** Session-marker setter calls that mark the timer/trip as live. */
  liveStateSetters: string[];
}

const REFERENCE_IMPLS: ReferenceImpl[] = [
  {
    file: 'src/hooks/useOffStandardSession.ts',
    fn:   'handleStartWith',
    liveStateSetters: [
      'setInProgressId(',
      'setStartTimestamp(',
      "setTimerState('running')",
    ],
  },
  {
    // Was TripStartForm's handleStartTripWith — the lifecycle moved to this hook
    // (near-cap extraction 2026-07-16); the contract follows the handler.
    file: 'src/hooks/useTripLifecycle.ts',
    fn:   'startTrip',
    liveStateSetters: [
      'setPendingTripId(',
      'setDepartureTime(',
      "setTripState('in_transit')",
    ],
  },
  {
    file: 'src/hooks/useDriverLiveTrip.ts',
    fn:   'handleStart',
    liveStateSetters: [
      // Single atomic transition replaces the three old flat setters.
      // dispatchStartTrip fires the 'startTrip' reducer action which atomically
      // sets phase:'in_transit', inProgressId, and departureTime in one shot.
      'dispatchStartTrip(',
    ],
  },
];

// ── Function-body extraction ─────────────────────────────────────────────────
//
// Locates `const <fn> = ... => {` and returns everything between that opening
// brace and its matching close, by brace counting. String- and comment-aware
// enough for the impls in scope (no template-literal expression nesting in
// these handlers — kept simple on purpose).

function extractFunctionBody(source: string, fnName: string): string {
  const declRe = new RegExp(`const\\s+${fnName}\\s*=`);
  const start  = source.search(declRe);
  if (start === -1) throw new Error(`Function ${fnName} not found in source`);

  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) throw new Error(`No opening brace after ${fnName}`);

  let depth = 0;
  let i = openBrace;
  let inString: '"' | "'" | '`' | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < source.length; i++) {
    const ch   = source[i];
    const prev = source[i - 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '/' && prev === '*') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') { inLineComment = true;  continue; }
    if (ch === '/' && source[i + 1] === '*') { inBlockComment = true; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  throw new Error(`Unbalanced braces while scanning ${fnName}`);
}

// ── The contract ─────────────────────────────────────────────────────────────

describe('Write-First Pattern — ordering contract', () => {
  describe.each(REFERENCE_IMPLS)('$file::$fn', ({ file, fn, liveStateSetters }) => {
    const absPath = resolve(file);
    const source  = readFileSync(absPath, 'utf-8');
    const body    = extractFunctionBody(source, fn);

    it('awaits a Supabase insert', () => {
      // Direct: await writeWithRefresh(() => supabase...insert(...))
      // Or delegated: await writeOrEnqueue('insert', ...)
      const directIdx    = body.search(/await\s+(?:writeWithRefresh\s*\(\s*\(\s*\)\s*=>\s*)?supabase[\s\S]*?\.insert\s*\(/);
      const delegatedIdx = body.search(/await\s+writeOrEnqueue\s*\(\s*'insert'/);
      const awaitInsertIdx = Math.max(directIdx, delegatedIdx);
      expect(
        awaitInsertIdx,
        `${fn} must contain "await supabase...insert(...)" or "await writeOrEnqueue('insert',...)" — write-first contract`,
      ).toBeGreaterThan(-1);
    });

    it('checks the error before any live-state setter fires', () => {
      const directIdx    = body.search(/await\s+(?:writeWithRefresh\s*\(\s*\(\s*\)\s*=>\s*)?supabase[\s\S]*?\.insert\s*\(/);
      const delegatedIdx = body.search(/await\s+writeOrEnqueue\s*\(\s*'insert'/);
      const awaitInsertIdx = Math.max(directIdx, delegatedIdx);
      // After the await, there must be an error check:
      //   - `if (error)` (direct pattern)
      //   - `if (!ok)` (writeOrEnqueue returns { ok })
      const tail = body.slice(awaitInsertIdx);
      const errorCheckIdx = tail.search(/if\s*\(\s*(?:error|!ok)\s*\)/);
      expect(
        errorCheckIdx,
        `${fn} must check the insert error before progressing — write-first contract`,
      ).toBeGreaterThan(-1);
    });

    it.each(liveStateSetters)(
      'live-state setter %s appears AFTER the awaited insert',
      setter => {
        const directIdx    = body.search(/await\s+(?:writeWithRefresh\s*\(\s*\(\s*\)\s*=>\s*)?supabase[\s\S]*?\.insert\s*\(/);
        const delegatedIdx = body.search(/await\s+writeOrEnqueue\s*\(\s*'insert'/);
        const awaitInsertIdx = Math.max(directIdx, delegatedIdx);
        const setterIdx      = body.indexOf(setter);

        expect(
          setterIdx,
          `${fn} must contain ${setter} (load-bearing live-state setter)`,
        ).toBeGreaterThan(-1);

        expect(
          setterIdx,
          `${fn}: ${setter} must appear AFTER "await supabase...insert" — moving it above silently breaks unmount-recovery (see ARCHITECTURE.md)`,
        ).toBeGreaterThan(awaitInsertIdx);
      },
    );
  });
});

// ── Sanity check for the source extractor ───────────────────────────────────

describe('extractFunctionBody — extractor sanity', () => {
  it('returns the balanced body between the first { and matching }', () => {
    const src = `
      const handleX = async () => {
        if (x) { return; }
        return 42;
      };
    `;
    const body = extractFunctionBody(src, 'handleX');
    expect(body.startsWith('{')).toBe(true);
    expect(body.endsWith('}')).toBe(true);
    expect(body).toContain('return 42;');
  });

  it('ignores braces inside strings', () => {
    const src = `const handleX = () => { const s = "}{"; return s; };`;
    const body = extractFunctionBody(src, 'handleX');
    expect(body).toBe(`{ const s = "}{"; return s; }`);
  });

  it('throws when the function is not present', () => {
    expect(() => extractFunctionBody('const otherFn = () => {};', 'handleX'))
      .toThrow(/not found/);
  });
});
