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

describe('DamageZoneBackfillView — the hail preset', () => {
  it('⭐ offers the top surfaces on a hail hold, in one tap', () => {
    // Hail falls downward, so a hail hold is nearly always the same three panels. 25 standing
    // hail holds were in the queue the day this shipped — 25 records that become one tap each.
    HOLDS = [hold({ id: 'h1', holdTypes: ['hail'], holdType: 'hail', notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hail — hood, roof, trunk' }));
    expect(zone('hood')).toHaveAttribute('aria-checked', 'true');
    expect(zone('roof')).toHaveAttribute('aria-checked', 'true');
    expect(zone('trunk-liftgate')).toHaveAttribute('aria-checked', 'true');
    // Selected, not saved — it is still his tap on Save that writes.
    expect(editHoldDamageZones).not.toHaveBeenCalled();
  });

  it('does not offer it on damage with no characteristic shape', () => {
    HOLDS = [hold({ id: 'h1', holdTypes: ['damage'], notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Hail/ })).toBeNull();
  });

  it('leaves the preset alone once he has started tagging by hand', () => {
    HOLDS = [hold({ id: 'h1', holdTypes: ['hail'], notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    fireEvent.click(zone('front-bumper'));
    expect(screen.queryByRole('button', { name: /Hail/ })).toBeNull();
  });
});

describe('DamageZoneBackfillView — a car with more than one hold', () => {
  it('⭐ names what is already tagged on the car, so a second visit is not mistaken for a lost tag', () => {
    // 30 of the 132 remaining holds sat on a car Aaron had already tagged, and the second visit
    // read as "my tag didn't save". It had saved — on the other hold.
    HOLDS = [
      hold({ id: 'h-tagged', vehicleId: 'veh-1', damageZones: ['trunk-liftgate'], notes: '' }),
      hold({ id: 'h-open', vehicleId: 'veh-1', notes: '' }),
    ];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('Already on this car')).toBeInTheDocument();
    expect(screen.getByText('Trunk / liftgate')).toBeInTheDocument();
    expect(screen.getByText(/this is a different hold/)).toBeInTheDocument();
  });

  it('⭐ walks a car\'s two open holds back to back, not scattered through the run', () => {
    HOLDS = [
      hold({ id: 'elsewhere', vehicleId: 'veh-9', notes: 'Rear lift gate' }),
      hold({ id: 'pair-a', vehicleId: 'veh-1', notes: 'Rear lift gate' }),
      hold({ id: 'pair-b', vehicleId: 'veh-1', notes: '' }),
    ];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.getByText('1 of 3 · 0 tagged')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    // Second stop is still the SAME car — its blank-note sibling, dragged along behind it.
    expect(screen.getByText('2 of 3 · 0 tagged')).toBeInTheDocument();
    expect(screen.getByText('LFJ396')).toBeInTheDocument();
  });

  it('says nothing about the car when this is its only hold', () => {
    HOLDS = [hold({ id: 'h1', vehicleId: 'veh-1', notes: '' })];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.queryByText('Already on this car')).toBeNull();
  });

  it('does not count a REPAIRED sibling — that damage is gone', () => {
    HOLDS = [
      hold({ id: 'fixed', vehicleId: 'veh-1', status: 'REPAIRED', damageZones: ['hood'] }),
      hold({ id: 'h-open', vehicleId: 'veh-1', notes: '' }),
    ];
    render(<DamageZoneBackfillView onBack={vi.fn()} />);
    expect(screen.queryByText('Already on this car')).toBeNull();
  });
});
