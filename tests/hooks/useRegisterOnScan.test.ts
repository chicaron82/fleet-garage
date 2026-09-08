import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegisterOnScan } from '../../src/hooks/useRegisterOnScan';
import type { Vehicle } from '../../src/types';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// ⭐ Aaron's rule, 2026-09-08, mid shift, after LJF710 went to overflow with an empty record:
//   "anything that reads keytags shouldn't be tossing out valuable info"
// The parsed fields were already kept here. The IMAGE was not — and the image is what settled
// LFJ400, whose tag turned out to print a bad VIN. A parse is a claim about the tag; the photo
// is the tag.

const HOLLOW: Vehicle = {
  id: 'v-hollow', unitNumber: null, licensePlate: 'LJF710',
  make: '', model: '', year: 0, color: '',
  status: 'CLEAR', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

const COMPLETE: Vehicle = {
  ...HOLLOW, id: 'v-complete', licensePlate: 'LUR537',
  unitNumber: '5427968', make: 'Chevrolet', model: 'Trax', year: 2026, color: 'Black',
};

const READ_HOLLOW: KeytagRead = {
  plate: 'LJF710', unitNumber: '5427800', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver',
};
const READ_NEW: KeytagRead = {
  plate: 'LUR900', unitNumber: '5429000', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White',
};
const READ_COMPLETE: KeytagRead = {
  plate: 'LUR537', unitNumber: '5427968', make: 'Chevrolet', model: 'Trax', year: 2026, color: 'Black',
};

const PHOTO = 'data:image/jpeg;base64,AAAA';
const USER = { id: 'u-1', branchId: 'YWG' } as never;

const addVehicle = vi.fn();
const updateVehicleFields = vi.fn();
const attachKeytagPhotoIfMissing = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  addVehicle.mockResolvedValue('v-new');
  updateVehicleFields.mockResolvedValue(undefined);
  attachKeytagPhotoIfMissing.mockResolvedValue(undefined);
});

const mount = (vehicles: Vehicle[]) =>
  renderHook(() => useRegisterOnScan({
    vehicles, addVehicle, updateVehicleFields, attachKeytagPhotoIfMissing, user: USER,
  }));

describe('useRegisterOnScan — the photo is kept', () => {
  it('⭐⭐ attaches the tag photo to a car it BACKFILLED', async () => {
    const { result } = mount([HOLLOW]);
    await act(async () => { await result.current.handleScanRead(READ_HOLLOW, PHOTO); });
    expect(updateVehicleFields).toHaveBeenCalled();
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-hollow', PHOTO);
  });

  it('⭐⭐ attaches to a car it just REGISTERED — the one whose photo is worth most', async () => {
    const { result } = mount([COMPLETE]);
    await act(async () => { await result.current.handleScanRead(READ_NEW, PHOTO); });
    expect(addVehicle).toHaveBeenCalled();
    // The id comes back from addVehicle; before this fix the register branch returned early.
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-new', PHOTO);
  });

  it('⭐ attaches even when the record is already COMPLETE and nothing needed writing', async () => {
    const { result } = mount([COMPLETE]);
    await act(async () => { await result.current.handleScanRead(READ_COMPLETE, PHOTO); });
    expect(updateVehicleFields).not.toHaveBeenCalled();
    expect(addVehicle).not.toHaveBeenCalled();
    // Nothing to write does NOT mean nothing to keep — 73 live cars have no tag photo.
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-complete', PHOTO);
  });

  it('⚠️ a unit collision rejects one FIELD, not the scan — the photo still lands', async () => {
    updateVehicleFields.mockResolvedValue({ unitConflict: { licensePlate: 'LUR999' } });
    const { result } = mount([HOLLOW]);
    await act(async () => { await result.current.handleScanRead(READ_HOLLOW, PHOTO); });
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-hollow', PHOTO);
  });

  it('⚠️ a failed backfill write must not swallow the photo', async () => {
    updateVehicleFields.mockRejectedValue(new Error('offline'));
    const { result } = mount([HOLLOW]);
    await act(async () => { await result.current.handleScanRead(READ_HOLLOW, PHOTO); });
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-hollow', PHOTO);
  });

  it('no photo passed → nothing is attached (callers that have no image are unaffected)', async () => {
    const { result } = mount([HOLLOW]);
    await act(async () => { await result.current.handleScanRead(READ_HOLLOW); });
    expect(updateVehicleFields).toHaveBeenCalled();
    expect(attachKeytagPhotoIfMissing).not.toHaveBeenCalled();
  });
});
