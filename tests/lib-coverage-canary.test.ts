import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Self-enforcing guard for the CLAUDE.md lib-coverage canary. The count (and the
// documented IO/glue gap list) is supposed to be bumped whenever a src/lib module
// is added — but that step kept slipping to the next cold line-check (drifted 3x
// by 2026-06-23). This test fails at the moment of drift, in CI, instead.

const root = process.cwd(); // vitest runs from the repo root

function liveCoverage() {
  const libs = readdirSync(join(root, 'src/lib')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const tests = new Set(
    readdirSync(join(root, 'tests/lib')).filter(f => f.endsWith('.test.ts')).map(f => f.replace('.test.ts', '')),
  );
  const names = libs.map(f => f.replace('.ts', ''));
  return {
    total: names.length,
    tested: names.filter(n => tests.has(n)).length,
    untested: names.filter(n => !tests.has(n)).sort(),
  };
}

describe('CLAUDE.md lib-coverage canary', () => {
  // Collapse whitespace so the hard-wrapped canary sentence matches as one line.
  const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8').replace(/\s+/g, ' ');
  const { total, tested, untested } = liveCoverage();

  it('the documented "X of Y" count matches live src/lib', () => {
    const m = claude.match(/(\d+) of (\d+) `src\/lib` modules are tested/);
    expect(m, 'lib-coverage canary line missing from CLAUDE.md').toBeTruthy();
    expect(
      { tested: Number(m![1]), total: Number(m![2]) },
      `CLAUDE.md says ${m![1]} of ${m![2]}; live is ${tested} of ${total}. Untested: ${untested.join(', ')}`,
    ).toEqual({ tested, total });
  });

  it('the documented gap list matches the actually-untested modules', () => {
    const clause = claude.match(/gaps are all IO\/glue \(([^)]+)\)/);
    expect(clause, 'gap list missing from CLAUDE.md canary').toBeTruthy();
    const documented = [...clause![1].matchAll(/`([^`]+)`/g)].map(g => g[1]).sort();
    expect(
      documented,
      `documented gaps drifted — untested modules are: ${untested.join(', ')}. A new untested module means pure logic may be going uncovered; test it or add it here deliberately.`,
    ).toEqual(untested);
  });
});
