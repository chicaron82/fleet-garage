import { describe, it, expect } from 'vitest';
import { buildTrail, trailHeadline, stopName } from '../../src/lib/myTrail';
import type { TrailChangeRow } from '../../src/lib/myTrail';

const ME = '9f560505-ea86-4dcf-0000-000000000000';

function row(p: Partial<TrailChangeRow> & { vehicleId: string }): TrailChangeRow {
  return {
    vehicleId: p.vehicleId,
    changedAt: p.changedAt ?? '2026-09-05T10:00:00Z',
    op: p.op ?? 'UPDATE',
    changed: p.changed ?? { odometer: { from: null, to: 7284 } },
    // ⚠️ `'actor' in p`, NOT `p.actor ?? ME`. `??` treats an EXPLICIT null as absent, so the helper
    // silently substituted his id for the null the bulk-import test was trying to express — and the
    // test failed against correct code. A helper that cannot state the case it is testing will send
    // you to "fix" the implementation instead.
    actor: 'actor' in p ? p.actor! : ME,
  };
}

const resolve = (id: string) =>
  id === 'car-1' ? { plate: 'MCM560', unitNumber: '5769880' }
  : id === 'car-2' ? { plate: 'LUR243', unitNumber: null }
  : null;

describe('buildTrail', () => {
  it('keeps only rows whose actor is his', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1' }),
      row({ vehicleId: 'car-2', actor: 'someone-else' }),
    ], [ME], resolve);
    expect(stops).toHaveLength(1);
    expect(stops[0].plate).toBe('MCM560');
  });

  it('drops the bulk-import rows, which have no actor at all', () => {
    // ⚠️ 3,383 of FG's 3,943 change rows are the 2026-08-19→30 import with actor null. Counting
    // those as work he did would be worse than showing no trail.
    expect(buildTrail([row({ vehicleId: 'car-1', actor: null })], [ME], resolve)).toEqual([]);
  });

  it('counts an agent acting as him', () => {
    const stops = buildTrail([row({ vehicleId: 'car-1', actor: 'dizee' })], [ME, 'dizee'], resolve);
    expect(stops).toHaveLength(1);
  });

  it('is case-insensitive about the actor', () => {
    const stops = buildTrail([row({ vehicleId: 'car-1', actor: 'DiZee' })], ['dizee'], resolve);
    expect(stops).toHaveLength(1);
  });

  it('ignores rows that are only script-written fields — a script ran, he was not there', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changed: { vin_last9: { from: null, to: 'X' }, owning_area: { from: null, to: '8199' } } }),
    ], [ME], resolve);
    expect(stops).toEqual([]);
  });

  it('keeps a row that mixes script fields with a real one, and reports only the real one', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changed: { vin_last9: { from: null, to: 'X' }, odometer: { from: null, to: 7284 } } }),
    ], [ME], resolve);
    expect(stops[0].did).toEqual(['Odometer']);
  });

  it('drops bookkeeping companions, so a capture reads "Odometer" and not "Odometer · Odometer at"', () => {
    // ⚠️ Found by running four real days of his changes through this and READING it: a whole lane of
    // odometer captures, every one of them doubled. `odometer_at` is stamped by the same write.
    // Reuses vehicleChanges' NOISE rather than keeping a second list here.
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changed: { odometer: { from: null, to: 7284 }, odometer_at: { from: null, to: '2026-09-03T20:16:00Z' } } }),
    ], [ME], resolve);
    expect(stops[0].did).toEqual(['Odometer']);
  });

  it('folds several writes to one car into a single stop, keeping the newest time', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changedAt: '2026-09-05T10:00:00Z', changed: { odometer: { from: null, to: 1 } } }),
      row({ vehicleId: 'car-1', changedAt: '2026-09-05T12:00:00Z', changed: { license_plate: { from: 'A', to: 'B' } } }),
    ], [ME], resolve);
    expect(stops).toHaveLength(1);
    expect(stops[0].touches).toBe(2);
    expect(stops[0].at).toBe('2026-09-05T12:00:00Z');
    expect(stops[0].did).toEqual(['Odometer', 'Plate']);   // deduped, sorted, FG's own labels
  });

  it('orders cars newest first', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changedAt: '2026-09-05T08:00:00Z' }),
      row({ vehicleId: 'car-2', changedAt: '2026-09-05T14:00:00Z' }),
    ], [ME], resolve);
    expect(stops.map(s => s.vehicleId)).toEqual(['car-2', 'car-1']);
  });

  it('survives a malformed row rather than throwing inside a render', () => {
    expect(() => buildTrail([
      row({ vehicleId: 'car-1', changed: {} }),
    ], [ME], resolve)).not.toThrow();
  });
});

describe('trailHeadline', () => {
  it('is empty when he has been nowhere, so the card can stay silent', () => {
    expect(trailHeadline([])).toBe('');
  });

  it('counts CARS, not writes — two touches at one car is one car', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1', changed: { odometer: { from: null, to: 1 } } }),
      row({ vehicleId: 'car-1', changed: { note: { from: null, to: 'x' } } }),
    ], [ME], resolve);
    expect(trailHeadline(stops)).toBe("You've been at one car today.");
  });

  it('pluralises', () => {
    const stops = buildTrail([
      row({ vehicleId: 'car-1' }), row({ vehicleId: 'car-2' }),
    ], [ME], resolve);
    expect(trailHeadline(stops)).toBe("You've been at 2 cars today.");
  });
});

describe('stopName', () => {
  it('names a car the way the rest of FG does', () => {
    const [s] = buildTrail([row({ vehicleId: 'car-1' })], [ME], resolve);
    expect(stopName(s)).toBe('MCM560 · 5769880');
  });

  it('degrades to whichever half it has', () => {
    const [s] = buildTrail([row({ vehicleId: 'car-2' })], [ME], resolve);
    expect(stopName(s)).toBe('LUR243');
  });

  it('admits when it knows neither, rather than rendering an empty row', () => {
    const [s] = buildTrail([row({ vehicleId: 'unknown-car' })], [ME], resolve);
    expect(stopName(s)).toBe('a car FG has no record of');
  });
});
