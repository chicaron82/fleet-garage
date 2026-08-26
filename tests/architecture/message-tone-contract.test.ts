import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A transient message must DECLARE what kind of news it is.
//
// Two surfaces each inherited a colour instead of choosing one, and failed in opposite directions:
// TripStartForm rendered `✨ Registered …` on Toast's default (documented as "the original red"),
// while AirportFlipSection hard-coded green and fed that same element "Could not read that tag —
// try again." Aaron, 2026-08-26, on the open ticket: "we're good to cook honey."
//
// ⚠️ The root cause was an API affordance, not a typo: the fallback variant was NAMED `default`,
// which invites omission, and omitting it silently meant "alert". Renaming it fixes the reading;
// this contract stops the omission coming back.

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
  });
}
const SOURCES = walk(join(ROOT, 'src')).map(f => ({ f, text: readFileSync(f, 'utf8') }));

describe('message tone is declared, never inherited', () => {
  // ⭐ The extractor is asserted first — a reshaped tree returning [] would make every check below
  // vacuously true, which is the failure mode these census-style contracts are most prone to.
  it('can see the source tree at all', () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(SOURCES.some(s => s.f.endsWith('Toast.tsx'))).toBe(true);
  });

  // ⭐⭐ THE REGRESSION. `<Toast message={x} />` with no variant is the exact line that announced a
  // registration in alert red.
  it('every <Toast> call site says what kind of message it is', () => {
    const bare: string[] = [];
    for (const { f, text } of SOURCES) {
      if (f.endsWith('Toast.tsx')) continue;   // the component itself declares the default
      for (const m of text.matchAll(/<Toast\b[^>]*\/>/gs)) {
        if (!m[0].includes('variant=')) bare.push(`${f.replace(ROOT + '/', '')}: ${m[0].slice(0, 70)}`);
      }
    }
    expect(bare, 'a <Toast> without a variant inherits "alert" silently').toEqual([]);
  });

  // ⚠️ ONE mapping from kind to colour. A second one is how the register form ended up with its own
  // EV dialect — a legitimate local need producing an illegitimate fork.
  it('only messageTone.ts maps a tone to a colour', () => {
    const maps = SOURCES
      .filter(s => /Record<\s*MessageTone/.test(s.text))
      .map(s => s.f.replace(ROOT + '/', ''));
    expect(maps.sort()).toEqual(['src/components/shared/Toast.tsx', 'src/lib/messageTone.ts']);
  });

  // ⚠️ And the surface that was hard-coding green must resolve its colour THROUGH the map, so the
  // words and the colour cannot disagree again.
  it('the airport flip toast derives its colour from the message', () => {
    const flip = SOURCES.find(s => s.f.endsWith('AirportFlipSection.tsx'))!.text;
    const line = flip.split('\n').find(l => l.includes('{toast.message}')) ?? '';
    expect(line, 'the flip toast line was not found').not.toBe('');
    expect(line).toContain('MESSAGE_TONE[toast.tone]');
    expect(line).not.toMatch(/text-(green|red|amber)-\d/);
  });
});
