import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackfillOnScan } from '../../src/hooks/useBackfillOnScan';
import type { Vehicle } from '../../src/types';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A geotab-migration placeholder: on record, but every identity field blank (year 0 is FG's
 *  unknown-year sentinel). This is the car the lot scan is meant to heal. */
const PLACEHOLDER: Vehicle = {
  id: 'v-geotab', unitNumber: null, licensePlate: 'LZM534',
  make: '', model: '', year: 0, color: '',
  status: 'OUT_ON_EXCEPTION', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

const COMPLETE: Vehicle = {
  ...PLACEHOLDER, id: 'v-complete', licensePlate: 'AAA111',
  unitNumber: '5423157', make: 'Hyundai', model: 'Elantra', year: 2026, color: 'Gray',
};

/** What the real LZM534 tag reads: unit 542 3157, CELA 26 GRA 4DR → Hyundai Elantra. */
const READ: KeytagRead = {
  plate: 'LZM534', unitNumber: '5423157',
  make: 'Hyundai', model: 'Elantra', year: 2026, color: 'Gray',
};

const updateVehicleFields = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  updateVehicleFields.mockResolvedValue(undefined);
});

const mount = (vehicles: Vehicle[]) =>
  renderHook(() => useBackfillOnScan({ vehicles, updateVehicleFields }));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useBackfillOnScan', () => {
  it('fills the blanks of an on-record placeholder and names what it filled', async () => {
    const { result } = mount([PLACEHOLDER]);

    await act(async () => { await result.current.backfillFromRead(READ); });

    expect(updateVehicleFields).toHaveBeenCalledTimes(1);
    const [vehicleId, fills] = updateVehicleFields.mock.calls[0];
    expect(vehicleId).toBe('v-geotab');
    expect(fills.map((f: { field: string }) => f.field).sort())
      .toEqual(['color', 'make', 'model', 'unitNumber', 'year']);
    // Show-your-work: the toast names the plate and the fields, never fills silently.
    expect(result.current.backfillToast).toContain('LZM534');
    // ⚠️⚠️ THIS USED TO ASSERT `toContain('make')` — and `make` is the ONE field whose raw name and
    // whose human label are identical, so the assertion could never tell them apart. It passed
    // unchanged while the toast printed `filled unitNumber, make` in half English and half
    // TypeScript. Assert a field where the two DIFFER, or the check is decoration.
    expect(result.current.backfillToast).toContain('unit,');
    expect(result.current.backfillToast).not.toContain('unitNumber');
  });

  it('no-ops when the record is already complete — nothing to fill', async () => {
    const { result } = mount([COMPLETE]);

    await act(async () => {
      await result.current.backfillFromRead({ ...READ, plate: 'AAA111' });
    });

    expect(updateVehicleFields).not.toHaveBeenCalled();
    expect(result.current.backfillToast).toBeNull();
  });

  it('no-ops for a plate that is not in the fleet — registering is not this hook’s job', async () => {
    const { result } = mount([PLACEHOLDER]);

    await act(async () => {
      await result.current.backfillFromRead({ ...READ, plate: 'ZZZ999' });
    });

    expect(updateVehicleFields).not.toHaveBeenCalled();
    expect(result.current.backfillToast).toBeNull();
  });

  it('never overwrites a MANUALLY-LOCKED value — a locked field blocks the tag', async () => {
    // make was manually set (field_sources 'manual') → the disagreeing tag is BLOCKED for make, and
    // surfaced on the conflict toast. The genuinely blank fields still fill.
    const locked: Vehicle = { ...PLACEHOLDER, make: 'Toyota', fieldSources: { make: 'manual' } };
    const { result } = mount([locked]);

    await act(async () => { await result.current.backfillFromRead(READ); });

    const applies = updateVehicleFields.mock.calls[0][1] as { field: string }[];
    expect(applies.map(f => f.field)).not.toContain('make'); // locked → blocked
    expect(applies.map(f => f.field)).toContain('unitNumber'); // blank → filled
    expect(result.current.conflictToast).toContain('make'); // the block is said out loud
  });

  it('CORRECTS an unlocked (inferred) value — the tag self-heals it, and says so', async () => {
    // make was never locked → the tag overrides the stale value (this is how the 156 inferred
    // classes self-heal). The override is applied AND named on the backfill toast.
    const inferred: Vehicle = { ...COMPLETE, id: 'v-inf', licensePlate: 'LZM534', make: 'Kia' };
    const { result } = mount([inferred]);

    await act(async () => { await result.current.backfillFromRead(READ); });

    const applies = updateVehicleFields.mock.calls[0][1] as { field: string }[];
    expect(applies.map(f => f.field)).toContain('make'); // unlocked → corrected
    expect(result.current.backfillToast).toMatch(/Kia → Hyundai/);
  });

  it('swallows a failed write — a backfill must never block what the operator came to do', async () => {
    updateVehicleFields.mockRejectedValue(new Error('offline'));
    const { result } = mount([PLACEHOLDER]);

    await act(async () => {
      await expect(result.current.backfillFromRead(READ)).resolves.toBeUndefined();
    });

    expect(result.current.backfillToast).toBeNull();
  });
});
