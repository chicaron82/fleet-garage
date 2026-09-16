import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchivedVehiclesSection } from '../../src/components/dashboard/ArchivedVehiclesSection';
import type { Vehicle } from '../../src/types';

// ⭐ VIEW AN ARCHIVED CAR WITHOUT RESTORING IT (Aaron, 2026-09-15).
//
// He had been RESTORING a car merely to look at it — and the 60-day auto-archive sweep undid that on
// the next Fleet open, because a restore returns an exception car to exactly the state that qualifies
// it. So the workaround could not work even in principle: *"i really just need the ability to view
// archived vehicles without having to restore it first."*
const car = (over: Partial<Vehicle> = {}) => ({
  id: 'v-arch', unitNumber: '5768866', licensePlate: '0GY993', make: 'Chevrolet', model: 'Trax',
  year: 2026, color: 'Gray', status: 'OUT_ON_EXCEPTION', branchId: 'YWG', isTesla: false,
  hasMobileCable: null, hasJ1772Adapter: null, archivedAt: '2026-09-16T02:30:08Z', ...over,
} as Vehicle);

const show = (onOpen?: (id: string) => void) =>
  render(<ArchivedVehiclesSection archivedVehicles={[car()]} onRestore={() => {}} onOpen={onOpen} />);

describe('ArchivedVehiclesSection — looking is not restoring', () => {
  it('⭐ offers View, and hands back the vehicle id', () => {
    const onOpen = vi.fn();
    show(onOpen);
    fireEvent.click(screen.getByText('Archived · 1'));   // collapsed by default
    fireEvent.click(screen.getByText('View'));
    expect(onOpen).toHaveBeenCalledWith('v-arch');
  });

  // ⚠️ Restore must survive untouched — it is still the right action for a car that really is back,
  // and this change is additive. (Its own defect, that the sweep re-archives it, is a separate item.)
  it('⚠️ still offers Restore alongside it', () => {
    show(() => {});
    fireEvent.click(screen.getByText('Archived · 1'));
    expect(screen.getByText('Restore')).toBeTruthy();
  });

  // ⚠️ The prop is optional so the component keeps working anywhere it has not been wired. Without a
  // handler there must be no dead button — a View that does nothing is worse than no View.
  it('⚠️ renders NO View button when nothing can handle it', () => {
    show(undefined);
    fireEvent.click(screen.getByText('Archived · 1'));
    expect(screen.queryByText('View')).toBeNull();
    expect(screen.getByText('Restore')).toBeTruthy();
  });

  it('shows the car and when it was archived', () => {
    show(() => {});
    fireEvent.click(screen.getByText('Archived · 1'));
    expect(screen.getByText('5768866')).toBeTruthy();
    expect(screen.getByText(/0GY993/)).toBeTruthy();
    expect(screen.getByText(/Archived Sep 1[56], 2026/)).toBeTruthy();
  });
});
