import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../src/lib/ev-detection', async (orig) => ({
  ...(await orig<typeof import('../../../src/lib/ev-detection')>()),
  searchVehicles: vi.fn(async () => []),
}));

import { VehicleLookup } from '../../../src/components/shared/VehicleLookup';
import type { VehicleSearchResult } from '../../../src/lib/ev-detection';

const car = (plate: string, o: Partial<VehicleSearchResult> = {}): VehicleSearchResult => ({
  license_plate: plate, unit_number: '5498035', make: 'Volvo', model: 'XC40', year: 2026,
  color: 'Brown', is_hybrid: false, is_tesla: false, archived_at: null, ...o,
});
const RECENTS = [car('MCN149'), car('LUR375', { unit_number: '5421001', make: 'Toyota', model: 'Corolla' })];
const field = () => screen.getByRole('textbox', { name: /look up a vehicle/i });

// ⭐ Aaron, 2026-09-21: "When I tap the field it would show the last 3."
describe('VehicleLookup — recent look-ups', () => {
  it('shows the recents when the empty field is focused', () => {
    render(<VehicleLookup onPick={vi.fn()} recents={RECENTS} />);
    expect(screen.queryByText('Recent')).toBeNull();
    fireEvent.focus(field());
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('MCN149')).toBeInTheDocument();
    expect(screen.getByText('LUR375')).toBeInTheDocument();
  });

  it('gets out of the way as soon as he types', () => {
    render(<VehicleLookup onPick={vi.fn()} recents={RECENTS} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'L' } });
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('picks a recent through the same path as a typed match', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} recents={RECENTS} />);
    fireEvent.focus(field());
    fireEvent.click(screen.getByText('MCN149').closest('button')!);
    expect(onPick).toHaveBeenCalledWith({ vehicle: RECENTS[0] });
    // Disarmed by the pick — the list must not spring back over the car card he just opened.
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('never claims a unit match for a recent (no query typed)', () => {
    render(<VehicleLookup onPick={vi.fn()} recents={RECENTS} />);
    fireEvent.focus(field());
    expect(screen.queryByText(/unit 5498035/)).toBeNull();
  });

  it('shows nothing on surfaces that pass no recents (closing inventory, airport flip)', () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    fireEvent.focus(field());
    expect(screen.queryByText('Recent')).toBeNull();
  });
});
