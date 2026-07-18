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
    expect(result.current.backfillToast).toContain('make');
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

  it('never overwrites a good existing value — a conflicting read is not a fill', async () => {
    // Same car, but the tag disagrees on make. resolveKeytag flags conflicts, never applies them;
    // only the genuinely blank unit# may land.
    const partiallyKnown: Vehicle = { ...PLACEHOLDER, make: 'Toyota', model: 'Corolla', year: 2024 };
    const { result } = mount([partiallyKnown]);

    await act(async () => { await result.current.backfillFromRead(READ); });

    const fills = updateVehicleFields.mock.calls[0][1] as { field: string }[];
    expect(fills.map(f => f.field)).not.toContain('make');
    expect(fills.map(f => f.field)).not.toContain('year');
    expect(fills.map(f => f.field)).toContain('unitNumber');
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
