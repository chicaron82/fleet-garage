import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPT } from '../../api/keytag-read';

// ⚠️⚠️ THE FABRICATED VEHICLE IDENTITY. On 2026-08-29 a 158-photo VIN backfill wrote `9TR289777`
// onto THREE different cars; a duplicate-VIN check is the only reason it surfaced. That string is
// the sample value printed in the prompt's own LAST 9 OF THE VIN instruction — when the model could
// not read the field, it echoed the example. The other sample, `8NF258345`, had been sitting on
// LJF679 since 2026-08-25 from an earlier backfill.
//
// A prompt instruction not to echo is a WISH. These tests guard the MECHANISM.

const SRC = readFileSync(join(process.cwd(), 'api/keytag-read.ts'), 'utf8');

describe('the prompt cannot become the answer', () => {
  it('⭐ every VIN-shaped literal in the prompt is in PROMPT_EXAMPLE_VINS', () => {
    // The guard is only as good as its list. A future edit that adds a new sample VIN to the prompt
    // and forgets the set would reopen the exact hole — so the test derives the list from the
    // prompt text rather than trusting the constant.
    const inPrompt = [...PROMPT.matchAll(/"([0-9A-Z]{9})"/g)].map(m => m[1]);
    const vinLike = inPrompt.filter(v => /^[0-9]/.test(v) && /[A-Z]/.test(v) && !/[IOQ]/.test(v));
    expect(vinLike.length, 'the prompt should still carry sample VINs to illustrate the shape').toBeGreaterThan(0);
    const guarded = SRC.slice(SRC.indexOf('PROMPT_EXAMPLE_VINS'), SRC.indexOf('PROMPT_EXAMPLE_VINS') + 400);
    for (const v of vinLike) {
      expect(guarded, `sample VIN ${v} appears in the prompt but is not guarded`).toContain(v);
    }
  });

  it('⭐ the prompt tells the model not to echo an example', () => {
    expect(PROMPT).toMatch(/NEVER output either example value/i);
    expect(PROMPT).toMatch(/empty field is correct/i);
  });

  it('⚠️ guards VINs only — the other examples are drawn from REAL cars', () => {
    // Unit 5424882 is LUR243's actual number. Blanking values like that would discard true
    // readings, and it is exactly why an echoed example is so hard to spot: it looks like data.
    const guarded = SRC.slice(SRC.indexOf('const PROMPT_EXAMPLE_VINS'), SRC.indexOf('const PROMPT_EXAMPLE_VINS') + 200);
    expect(guarded).not.toContain('5424882');
    expect(guarded).not.toContain('LUR243');
  });
});
