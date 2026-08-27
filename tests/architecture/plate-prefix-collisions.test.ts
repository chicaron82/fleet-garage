import { describe, it, expect } from 'vitest';
import { MB_PLATE_PREFIXES, correctManitobaPlate } from '../../api/_lib/platePrefix';

// A CONTRACT ABOUT THE PREFIX LIST ITSELF, not about any one plate.
//
// ⚠️ `snapPrefix` only corrects on a UNIQUE one-character hit, so adding a prefix that sits one
// character from an existing one silently DISABLES corrections for both. That has already happened
// once and was only caught by hand: adding MCM and MCN cost `MZM` its snap to LZM, because MZM is
// now one character from LZM *and* MCM. The file documents that as "deliberate and worth knowing" —
// which is fine, as long as the next person KNOWS. Nothing was checking.
//
// This turns that hazard into a mechanism: any future addition that creates a new one-apart pair
// turns this red and has to be justified out loud rather than discovered months later by a car
// quietly losing its safety net.
const dist = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length;

describe('MB_PLATE_PREFIXES as a set', () => {
  it('has no two prefixes one character apart, except the pairs we know about', () => {
    // The two KNOWN, accepted pairs. Both are real prefixes in the fleet, so neither can be removed;
    // they are listed here so the check stays sharp about everything else.
    const accepted = new Set(['KUR|LUR', 'MCM|MCN']);
    const surprises: string[] = [];
    for (let i = 0; i < MB_PLATE_PREFIXES.length; i++) {
      for (let j = i + 1; j < MB_PLATE_PREFIXES.length; j++) {
        const [a, b] = [MB_PLATE_PREFIXES[i], MB_PLATE_PREFIXES[j]].sort();
        if (dist(a, b) === 1 && !accepted.has(`${a}|${b}`)) surprises.push(`${a}|${b}`);
      }
    }
    expect(surprises).toEqual([]);
  });

  it('every prefix is three uppercase letters', () => {
    for (const p of MB_PLATE_PREFIXES) expect(p).toMatch(/^[A-Z]{3}$/);
  });

  it('has no duplicates', () => {
    expect(new Set(MB_PLATE_PREFIXES).size).toBe(MB_PLATE_PREFIXES.length);
  });

  // ⭐ KGE's own reason for being here: a live Manitoba car wore it with no correction at all.
  it('includes KGE, and adding it did not cost an existing prefix its snap', () => {
    expect(MB_PLATE_PREFIXES).toContain('KGE');
    // LUR's body correction still works — the canary for "did a new prefix break a neighbour".
    expect(correctManitobaPlate('LURL43')).toBe('LUR143');
  });
});
