import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A watch must reach a car FG has NEVER SEEN.
//
// Aaron, 2026-08-26: *"can I add a license plate to watch for? it doesn't exist in FG. so if I
// scanned it, it would tell me to hold it."*
//
// ⚠️ WHY A SOURCE CONTRACT. ScanPlateWatch is unit-tested and plateWatch's matching is unit-tested,
// and BOTH would stay green if the banner were nested inside the `vehicle ? (...)` branch of the
// scan sheet — which would break the entire feature, silently, for exactly the cars it exists for.
// The property is about WHERE it renders, so that is what gets asserted. Same lesson as the
// one-shot-screen contract earlier today: test the wiring that was actually capable of being wrong.

const OVERLAY = readFileSync(
  join(process.cwd(), 'src/components/scan-router/ScanRouterOverlay.tsx'), 'utf8');

describe('the plate watch reaches an unregistered car', () => {
  it('is rendered by the scan sheet at all', () => {
    expect(OVERLAY).toContain('ScanPlateWatch');
    expect(OVERLAY).toContain('watchFor(');
  });

  // ⭐⭐ THE LOAD-BEARING ASSERTION. The vehicle block opens at `{result && (`; anything after it
  // can end up gated on a resolved vehicle. The watch must sit BEFORE that, so an unresolved read
  // — the stranger car, the whole point — still gets stopped instead of being walked straight to
  // "register it".
  it('renders BEFORE the vehicle block, not inside it', () => {
    const watchAt = OVERLAY.indexOf('<ScanPlateWatch');
    const vehicleBlockAt = OVERLAY.indexOf('{result && (');
    expect(watchAt).toBeGreaterThan(-1);
    expect(vehicleBlockAt).toBeGreaterThan(-1);
    expect(watchAt, 'the watch banner has moved inside the resolved-vehicle block')
      .toBeLessThan(vehicleBlockAt);
  });

  // ⚠️ Matched on the READ plate. `vehicle?.licensePlate` is authoritative once a car resolves —
  // but a watched stranger car has no record to take a plate from, so keying off it would go
  // undefined precisely when the watch matters.
  it('matches on the scanned plate, never the record\'s', () => {
    const call = OVERLAY.slice(OVERLAY.indexOf('watchFor('), OVERLAY.indexOf(')', OVERLAY.indexOf('watchFor(')) + 1);
    expect(call).toContain('result.plate');
    expect(call).not.toContain('vehicle');
  });

  // ⚠️ And the matcher must not run the plate through the MB corrector. It is prefix-gated and so
  // leaves DFDA712 alone today, but the principle outranks today's behaviour: a watch that
  // "corrects" a plate could tell him to hold the WRONG car, on the one surface whose job is to be
  // believed. A missed watch costs one car going out; a wrong one costs his trust in the banner.
  it('does not launder the plate through correctManitobaPlate', () => {
    const lib = readFileSync(join(process.cwd(), 'src/lib/plateWatch.ts'), 'utf8');
    expect(lib).not.toContain('correctManitobaPlate(');
  });
});
