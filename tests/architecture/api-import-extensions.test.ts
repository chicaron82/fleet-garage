// Every relative import inside api/ must carry an explicit .js extension.
//
// ⚠️ WHY THIS EXISTS — the scanner was DEAD IN PRODUCTION for 19 hours (2026-08-18 19:17 →
// 2026-08-19 14:50) and nothing in the repo noticed. `api/keytag-read.ts` imported two new helpers
// as './_lib/keytagEscalation' and './_lib/owningArea', without the extension every other local
// import in that same file already had. Vercel's ESM runtime cannot resolve an extensionless
// specifier: the module never loads, and the function dies before executing a line —
// FUNCTION_INVOCATION_FAILED, returned as plain text rather than JSON, so the app showed a generic
// "could not read that key tag" and Aaron re-photographed a perfectly legible tag on his shift.
//
// ⭐ NOTHING ELSE CAN CATCH THIS. `tsc` resolves extensionless imports. vitest resolves them. The
// e2e flow tests never call the real endpoint. The build is green, the types are sound, the tests
// pass, and the deployed function is a crater. The only evidence was an ABSENCE — no spend row in
// the ledger, because the code that writes one never ran.
//
// So the check is mechanical and lives here rather than in anyone's memory.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = join(process.cwd(), 'api');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(full)) out.push(full);
  }
  return out;
}

/** Relative specifiers only — bare package names ('@supabase/supabase-js') must NOT have one. */
const RELATIVE = /from\s+'(\.[^']*)'/g;

describe('api/ import extensions', () => {
  it('⭐ every relative import under api/ ends in .js', () => {
    const offenders: string[] = [];
    for (const file of walk(API)) {
      const src = readFileSync(file, 'utf8');
      for (const [, spec] of src.matchAll(RELATIVE)) {
        if (!spec.endsWith('.js')) {
          offenders.push(`${file.slice(process.cwd().length + 1)} → '${spec}'`);
        }
      }
    }
    expect(
      offenders,
      'These imports will not resolve on Vercel. The function will fail to LOAD — a plain-text 500 ' +
      'with no JSON body — while tsc, vitest and the build all stay green:\n  ' + offenders.join('\n  '),
    ).toEqual([]);
  });

  it('the check would have caught the real regression', () => {
    // A guard nobody has seen fail is a guard nobody trusts. This proves the matcher fires on the
    // exact line that took the scanner down.
    const broken = "import { shouldEscalate } from './_lib/keytagEscalation';";
    const specs = [...broken.matchAll(RELATIVE)].map(m => m[1]);
    expect(specs).toEqual(['./_lib/keytagEscalation']);
    expect(specs.every(s => s.endsWith('.js'))).toBe(false);
  });
});
