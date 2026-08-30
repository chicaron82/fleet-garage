import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HybridGapsSection } from '../../src/components/my-shift/HybridGapsSection';
import type { Vehicle } from '../../src/types';

const car: Vehicle = {
  id: 'v-541', unitNumber: '5421995', licensePlate: 'LZM541', make: 'Toyota', model: 'Corolla',
  year: 2026, color: 'Gray', status: 'CLEAR', branchId: 'YWG', isTesla: false, isHybrid: false,
  hasMobileCable: null, hasJ1772Adapter: null, rentalClass: 'E6', classCode: 'CCLH',
};

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ allVehicles: [car] }),
}));

// ⭐ Aaron, looking at this exact card on 2026-08-30: *"LZM541, has an issue. this isn't tappable.
// so i have to look this up to make the correction."* The card's job is to send him to a car; a
// to-do list that cannot open its own items makes him do the lookup by hand, once per row.
describe('HybridGapsSection', () => {
  it('names the car and why it looks like a hybrid', () => {
    render(<HybridGapsSection />);
    expect(screen.getByText('LZM541')).toBeInTheDocument();
    expect(screen.getByText(/CCLH/)).toBeInTheDocument();
  });

  it('⭐ the row opens that car when a caller can navigate', () => {
    const onOpenVehicle = vi.fn();
    render(<HybridGapsSection onOpenVehicle={onOpenVehicle} />);
    fireEvent.click(screen.getByRole('button', { name: /LZM541/ }));
    expect(onOpenVehicle).toHaveBeenCalledWith('v-541');
  });

  // ⚠️ Optional by design (ChronicIssuesSection's shape): the card must still render everywhere it
  // isn't wired, as plain text rather than a dead button.
  it('⚠️ stays plain text with no navigation available', () => {
    render(<HybridGapsSection />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('LZM541')).toBeInTheDocument();
  });

  // ⚠️ THE PART THAT MUST NOT ARRIVE. Flipping a powertrain from two fields would be FG deciding;
  // "usually right" is not a licence to write. He taps THROUGH and decides at the record.
  it('⚠️ offers no flag button — only a way to go look', () => {
    render(<HybridGapsSection onOpenVehicle={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /flag|hybrid\?|mark/i })).not.toBeInTheDocument();
  });
});
