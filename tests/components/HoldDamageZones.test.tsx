import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Hold } from '../../src/types';

// WHERE the damage is (docs/ticket-damage-zones.md). Aaron's cut of 2026-08-22 is the thing under
// test: tagging a zone is annotation on a record that already has its photos — NO camera — which is
// the only reason the 441 holds already on the books can ever be tagged at all.

const editHoldDamageZones = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ editHoldDamageZones }),
}));

import { HoldDamageZones } from '../../src/components/holds/HoldDamageZones';

const hold = (over: Partial<Hold> = {}): Hold => ({
  id: 'hold-1', vehicleId: 'veh-1',
  holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Dent — minor (no paint break)',
  flaggedById: 'u-1', flaggedByName: 'Aaron S.', flaggedByEmployeeId: '331965',
  flaggedAt: '2026-08-14T15:48:00Z', notes: '', status: 'RELEASED', branchId: 'YWG',
  ...over,
});

const zone = (id: string) => document.querySelector(`[data-zone="${id}"]`)!;

beforeEach(() => editHoldDamageZones.mockClear());

describe('HoldDamageZones — the read-back', () => {
  it('names the tagged panels as chips', () => {
    render(<HoldDamageZones hold={hold({ damageZones: ['trunk-liftgate', 'hood'] })} />);
    expect(screen.getByText('Hood')).toBeInTheDocument();
    expect(screen.getByText('Trunk / liftgate')).toBeInTheDocument();
  });

  it('⭐ says so out loud when nothing is recorded', () => {
    // "Not recorded" is not an empty state — it is the backfill's to-do list, and it must be
    // visible on the card or nobody ever knows which holds still need tagging.
    render(<HoldDamageZones hold={hold()} />);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('offers Edit rather than Add once zones exist', () => {
    render(<HoldDamageZones hold={hold({ damageZones: ['hood'] })} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('HoldDamageZones — tagging', () => {
  it('⭐ opens a diagram and NEVER a camera', () => {
    // The whole feature turns on this. A capture step would mean a hold can only be tagged with
    // the car present, which locks out every hold already on the books.
    const { container } = render(<HoldDamageZones hold={hold()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTestId('damage-zone-map')).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[capture]')).toBeNull();
  });

  it('shows his own note beside the diagram — it is what he tags from', () => {
    render(<HoldDamageZones hold={hold({ notes: 'Rear lift gate ' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('"Rear lift gate"')).toBeInTheDocument();
  });

  it('stages taps and writes once, in display order', async () => {
    render(<HoldDamageZones hold={hold()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(zone('trunk-liftgate'));
    fireEvent.click(zone('hood'));            // tapped back-to-front on purpose
    expect(editHoldDamageZones).not.toHaveBeenCalled();   // nothing written yet

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(editHoldDamageZones).toHaveBeenCalledWith('hold-1', ['hood', 'trunk-liftgate']));
    expect(editHoldDamageZones).toHaveBeenCalledTimes(1);
  });

  it('a second tap clears a panel', async () => {
    render(<HoldDamageZones hold={hold({ damageZones: ['hood'] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(zone('hood'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // ⭐ Clearing to EMPTY must be allowed — it is how a mistagged hold gets fixed. The sibling
    // description editor rejects empty; borrowing that guard here would trap a wrong tag forever.
    await waitFor(() => expect(editHoldDamageZones).toHaveBeenCalledWith('hold-1', []));
  });

  it('does not write when nothing changed', async () => {
    render(<HoldDamageZones hold={hold({ damageZones: ['hood'] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('damage-zone-map')).toBeNull());
    expect(editHoldDamageZones).not.toHaveBeenCalled();
  });

  it('shows the failure instead of pretending it saved', async () => {
    editHoldDamageZones.mockRejectedValueOnce(new Error('network is down'));
    render(<HoldDamageZones hold={hold()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(zone('hood'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('network is down')).toBeInTheDocument());
    expect(screen.getByTestId('damage-zone-map')).toBeInTheDocument();  // stays open to retry
  });

  it('re-seeds the draft from the row each time it opens', () => {
    // Not seed-once: cancel after tapping, reopen, and the abandoned taps must be gone.
    render(<HoldDamageZones hold={hold({ damageZones: ['hood'] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(zone('rear-bumper'));
    expect(screen.getByText('2 tagged')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('1 tagged')).toBeInTheDocument();
  });

  it('marks a tagged panel as checked on the diagram', () => {
    render(<HoldDamageZones hold={hold({ damageZones: ['hood'] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(zone('hood')).toHaveAttribute('aria-checked', 'true');
    expect(zone('roof')).toHaveAttribute('aria-checked', 'false');
  });
});
