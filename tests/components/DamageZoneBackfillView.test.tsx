import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Hold, Vehicle } from '../../src/types';

// Phase 3 — the backfill run (docs/ticket-damage-zones.md). The journey Aaron described:
// "easier to back fill them, which I can do on my spare time." The screen that matters is getting
// through a list, not a field inside one hold.

const editHoldDamageZones = vi.fn().mockResolvedValue(undefined);
let HOLDS: Hold[] = [];
const VEHICLES: Vehicle[] = [{
  id: 'veh-1', unitNumber: '5421011', licensePlate: 'LFJ396', make: 'Nissan', model: 'Versa',
  year: 2025, color: 'White', branchId: 'YWG', status: 'PRE_EXISTING',
} as Vehicle];

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ holds: HOLDS, allVehicles: VEHICLES, editHoldDamageZones }),
}));

import { DamageZoneBackfillView } from '../../src/components/holds/DamageZoneBackfillView';

const hold = (over: Partial<Hold> & { id: string }): Hold => ({
  vehicleId: 'veh-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Scratch — paint surface', flaggedById: 'u-1', flaggedByName: 'Aaron S.',
  flaggedByEmployeeId: '331965', flaggedAt: '2026-08-21T19:17:00Z', notes: '',
  status: 'RELEASED', branchId: 'YWG', ...over,
});

const zone = (id: string) => document.querySelector(`[data-zone="${id}"]`)!;
beforeEach(() => { editHoldDamageZones.mockClear(); });

describe('DamageZoneBackfillView', () => {
  it('says so plainly when there is nothing left to tag', () => {
    HOLDS = [hold({ id: 'h1', damageZones: ['hood'] })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('Nothing left to tag')).toBeInTheDocument();
  });

  it('shows the car, the note and the position in the queue', () => {
    HOLDS = [hold({ id: 'h1', notes: 'Rear lift gate ' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('5421011')).toBeInTheDocument();
    expect(screen.getByText('LFJ396')).toBeInTheDocument();
    expect(screen.getByText('"Rear lift gate"')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 · 0 tagged')).toBeInTheDocument();
  });

  it('⭐ SUGGESTS from the note without selecting anything', () => {
    // The rule the plate cross-check cost me: a pre-selected guess gets confirmed without being
    // read. The panel is drawn as a candidate, and the Save button has nothing to save yet.
    HOLDS = [hold({ id: 'h1', notes: 'Rear lift gate' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(zone('trunk-liftgate')).toHaveAttribute('data-suggested', 'true');
    expect(zone('trunk-liftgate')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByText(/could be/)).toHaveTextContent('Trunk / liftgate');
  });

  it('offers BOTH doors when the note does not say which', () => {
    HOLDS = [hold({ id: 'h1', notes: 'Poorly covered up dent, driver door' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(zone('driver-front-door')).toHaveAttribute('data-suggested', 'true');
    expect(zone('driver-rear-door')).toHaveAttribute('data-suggested', 'true');
  });

  it('confirms a suggestion with one tap and moves on', async () => {
    HOLDS = [hold({ id: 'h1', notes: 'Rear lift gate' }), hold({ id: 'h2', notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    fireEvent.click(zone('trunk-liftgate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 & next' }));
    await waitFor(() => expect(editHoldDamageZones).toHaveBeenCalledWith('h1', ['trunk-liftgate']));
    await waitFor(() => expect(screen.getByText('2 of 2 · 1 tagged')).toBeInTheDocument());
  });

  it('⭐ Skip advances WITHOUT writing anything', () => {
    // A hold he cannot place must stay untagged rather than acquire a guess.
    HOLDS = [hold({ id: 'h1', notes: '' }), hold({ id: 'h2', notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(editHoldDamageZones).not.toHaveBeenCalled();
    expect(screen.getByText('2 of 2 · 0 tagged')).toBeInTheDocument();
  });

  it('⭐ puts the notes it can read FIRST, so the run opens fast', () => {
    HOLDS = [
      hold({ id: 'blank', notes: '' }),
      hold({ id: 'pinned', notes: 'Rear lift gate' }),
    ];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('"Rear lift gate"')).toBeInTheDocument();
  });

  it('leaves repaired holds out of the run entirely', () => {
    HOLDS = [hold({ id: 'h1', status: 'REPAIRED' }), hold({ id: 'h2', status: 'VOIDED' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('Nothing left to tag')).toBeInTheDocument();
  });

  it('keeps the run going when a save fails', async () => {
    editHoldDamageZones.mockRejectedValueOnce(new Error('offline'));
    HOLDS = [hold({ id: 'h1', notes: 'Rear lift gate' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    fireEvent.click(zone('trunk-liftgate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 & next' }));
    await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());
    expect(screen.getByText('1 of 1 · 0 tagged')).toBeInTheDocument();   // did not advance past it
  });

  it('shows the photos — they are what he tags from', () => {
    HOLDS = [hold({ id: 'h1', photos: ['https://x/a.jpg', 'https://x/b.jpg'] })];
    const { container } = render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });
});
