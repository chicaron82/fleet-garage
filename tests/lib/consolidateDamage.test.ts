import { describe, it, expect } from 'vitest';
import { consolidateDamage, cycleLabel } from '../../src/lib/consolidateDamage';
import type { ScanHoldLine } from '../../src/lib/scanHoldSummary';

const line = (o: Partial<ScanHoldLine> & { id: string; flaggedAt: string }): ScanHoldLine => ({
  typeLabel: 'Damage', detail: 'Scratch — paint surface', onException: false, zones: [], ...o,
});

// Every fixture below is a REAL live group from the fleet on 2026-08-29, named by its plate, so the
// cases this file defends are cases that exist rather than ones I invented.

describe('consolidateDamage — the cases in the live data', () => {
  // 0ES681: same words, same single panel, 62 days apart. Two hold/release cycles on one defect.
  it('merges identical text on an identical panel', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-08-06T00:00:00Z', detail: 'Missing part / accessory', zones: ['wheel-driver-front'] }),
      line({ id: 'a', flaggedAt: '2026-06-05T00:00:00Z', detail: 'Missing part / accessory', zones: ['wheel-driver-front'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'b', cycles: 2, zones: ['wheel-driver-front'] });
    expect(out[0].firstFlaggedAt).toBe('2026-06-05T00:00:00Z');
    expect(out[0].lastFlaggedAt).toBe('2026-08-06T00:00:00Z');
  });

  // ⚠️⚠️ LFJ285 — THE COUNTER-EXAMPLE THAT KILLED TEXT-ONLY MATCHING. Identical description,
  // different panels, so these are two real damages and merging them would hide one.
  it('⚠️ never merges identical text on DIFFERENT panels', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-08-06T00:00:00Z', detail: 'scratches and scuffs on rear bumper corner', zones: ['passenger-rear-quarter'] }),
      line({ id: 'a', flaggedAt: '2026-07-03T00:00:00Z', detail: 'scratches and scuffs on rear bumper corner', zones: ['rear-bumper'] }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(d => d.cycles)).toEqual([1, 1]);
  });

  // 0ES646 — one zone list contains the other. Aaron's call: *"0ES646 merge"*.
  it('⭐ merges a SUPERSET into one line, keeping the union of panels', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-06-08T00:00:00Z', zones: ['passenger-rear-door', 'passenger-rear-quarter'] }),
      line({ id: 'a', flaggedAt: '2026-04-28T00:00:00Z', zones: ['passenger-rear-quarter'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].cycles).toBe(2);
    expect(out[0].zones).toEqual(['passenger-rear-door', 'passenger-rear-quarter']);
  });

  // ⚠️ Aaron's call on the zone-less holds: text-only fallback. Five live holds have no zones, four
  // of them "Missing part / accessory" — a category with no panel to point at.
  it('⚠️ falls back to text-only when a hold carries no zones', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-05-05T00:00:00Z', detail: 'Missing part / accessory' }),
      line({ id: 'a', flaggedAt: '2026-04-20T00:00:00Z', detail: 'Missing part / accessory' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].cycles).toBe(2);
    expect(out[0].zones).toEqual([]);
  });

  it('a zone-less hold joins a zoned group with the same words', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-06-01T00:00:00Z', zones: ['front-bumper'] }),
      line({ id: 'a', flaggedAt: '2026-04-01T00:00:00Z' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].zones).toEqual(['front-bumper']);
  });

  it('keeps genuinely different damage apart', () => {
    const out = consolidateDamage([
      line({ id: 'a', flaggedAt: '2026-05-06T00:00:00Z', detail: 'Rim / hubcap damage' }),
      line({ id: 'b', flaggedAt: '2026-08-26T00:00:00Z', detail: 'Hail damage' }),
    ]);
    expect(out).toHaveLength(2);
  });

  // LFJ370 — the deepest card in the fleet. Four live lines, two byte-identical from the same day.
  it('⭐ takes LFJ370 from four lines to three', () => {
    const out = consolidateDamage([
      line({ id: 'd', flaggedAt: '2026-08-26T00:00:00Z', detail: 'Hail damage', typeLabel: 'Hail', onException: true }),
      line({ id: 'c', flaggedAt: '2026-08-04T00:00:00Z', detail: 'Dent — minor (no paint break); Windshield chip' }),
      line({ id: 'b', flaggedAt: '2026-08-04T00:00:00Z', detail: 'Dent — minor (no paint break); Windshield chip' }),
      line({ id: 'a', flaggedAt: '2026-05-06T00:00:00Z', detail: 'Rim / hubcap damage' }),
    ]);
    expect(out).toHaveLength(3);
    expect(out.find(d => d.detail.startsWith('Dent'))!.cycles).toBe(2);
    expect(out[0].detail).toBe('Hail damage');   // newest first
  });
});

describe('consolidateDamage — what must survive the merge', () => {
  // ⭐⭐ THE ONE THING COLLAPSING MUST NEVER SOFTEN. If any cycle went out on exception, the car is
  // carrying that damage right now — the whole reason the card shouts.
  it('⭐ stays on-exception if ANY merged cycle was', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-08-06T00:00:00Z', zones: ['front-bumper'], onException: false }),
      line({ id: 'a', flaggedAt: '2026-06-05T00:00:00Z', zones: ['front-bumper'], onException: true }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].onException).toBe(true);
  });

  it('normalises case and spacing before comparing text', () => {
    const out = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-08-06T00:00:00Z', detail: 'Windshield  Chip' }),
      line({ id: 'a', flaggedAt: '2026-06-05T00:00:00Z', detail: 'windshield chip' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('is empty for no lines, and a passthrough for one', () => {
    expect(consolidateDamage([])).toEqual([]);
    const one = consolidateDamage([line({ id: 'a', flaggedAt: '2026-08-06T00:00:00Z' })]);
    expect(one).toHaveLength(1);
    expect(one[0].cycles).toBe(1);
  });
});

describe('cycleLabel', () => {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  it('names the cycles and the FIRST date — the history he built on purpose', () => {
    const [d] = consolidateDamage([
      line({ id: 'b', flaggedAt: '2026-08-06T12:00:00Z', zones: ['front-bumper'] }),
      line({ id: 'a', flaggedAt: '2026-04-28T12:00:00Z', zones: ['front-bumper'] }),
    ]);
    expect(cycleLabel(d, fmt)).toMatch(/^held 2× since Apr 28$/);
  });

  // "held 1×" on every single-cycle line would be noise on the common case.
  it('says nothing for a single cycle', () => {
    const [d] = consolidateDamage([line({ id: 'a', flaggedAt: '2026-08-06T00:00:00Z' })]);
    expect(cycleLabel(d, fmt)).toBe('');
  });
});
