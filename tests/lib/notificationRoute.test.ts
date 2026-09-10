import { describe, it, expect } from 'vitest';
import { notificationRoute } from '../../src/lib/notificationRoute';

describe('notificationRoute', () => {
  it('no metadata → not tappable', () => {
    expect(notificationRoute(undefined)).toBeNull();
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute({})).toBeNull();
  });

  it('a vehicle notification opens the car', () => {
    expect(notificationRoute({ vehicleId: 'veh-1' })).toEqual({ kind: 'vehicle', vehicleId: 'veh-1' });
  });

  it('approval requests open their sheets', () => {
    expect(notificationRoute({ type: 'oth_edit_request', entryId: 'e1' }))
      .toEqual({ kind: 'oth-edit-approval', entryId: 'e1' });
    expect(notificationRoute({ type: 'oth_backdate_request', entryId: 'e2' }))
      .toEqual({ kind: 'backdate-approval', entryId: 'e2' });
    expect(notificationRoute({ type: 'vehicle_edit_request', vehicleId: 'veh-2' }))
      .toEqual({ kind: 'vehicle-edit-approval', vehicleId: 'veh-2' });
  });

  it('a vehicle-edit request goes to the approval, not the car page', () => {
    // It carries a vehicleId, which would otherwise read as a plain vehicle jump.
    expect(notificationRoute({ type: 'vehicle_edit_request', vehicleId: 'veh-3' })?.kind)
      .toBe('vehicle-edit-approval');
  });

  it('an approval missing its id falls back to the car, then to nothing', () => {
    expect(notificationRoute({ type: 'oth_edit_request', vehicleId: 'veh-4' }))
      .toEqual({ kind: 'vehicle', vehicleId: 'veh-4' });
    expect(notificationRoute({ type: 'oth_backdate_request' })).toBeNull();
  });

  it('ignores non-string ids', () => {
    expect(notificationRoute({ vehicleId: 42 })).toBeNull();
    expect(notificationRoute({ type: 'oth_edit_request', entryId: '' })).toBeNull();
  });
});
