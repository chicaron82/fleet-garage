// The re-plate offer as any surface gets it — one line, no props about how plates are written.
//
// ⚠️ WHY THIS EXISTS: the offer was wired into four surfaces (closing inventory, Lost & Found, the
// airport flip, movement sends) and only ONE of them — ScanBranch — had a component test. The other
// three are the same single line, which is an argument, not a test. This covers the piece all four
// share, so each call site is backed by something exercised: the context resolution is the wrapper's
// entire job, and it is the part that can silently break for every surface at once.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { KeytagReplateOffer } from '../../src/components/scan-router/KeytagReplateOffer';
import type { Vehicle } from '../../src/types';

const adoptPlate = vi.fn(async () => true);
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ adoptPlate }),
}));

// Aaron's real car, 2026-09-06: unit 5508783 came back wearing MB plates.
const car = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v-5508783', unitNumber: '5508783', licensePlate: 'LJF682', make: 'Tesla', model: 'Model 3',
  year: 2022, color: 'Black', status: 'CLEAR', branchId: 'YWG', isTesla: true,
  hasMobileCable: null, hasJ1772Adapter: null, ...over,
});

beforeEach(() => adoptPlate.mockClear());

describe('KeytagReplateOffer', () => {
  it('offers when the tag carries a genuinely different plate', () => {
    render(<KeytagReplateOffer vehicle={car()} tagPlate="MCM565" scanNonce={1} />);
    expect(screen.getByText(/different plate, not a misread/)).toBeInTheDocument();
    expect(screen.getByText('MCM565')).toBeInTheDocument();
    expect(screen.getByText('LJF682')).toBeInTheDocument();
  });

  it('⭐ resolves adoptPlate from CONTEXT — the wrapper\'s entire reason to exist', async () => {
    render(<KeytagReplateOffer vehicle={car()} tagPlate="MCM565" scanNonce={1} />);
    await userEvent.click(screen.getByRole('button', { name: /New plates/ }));
    // The vehicle's ID and the TAG's plate — never the record's, which is the stale half.
    expect(adoptPlate).toHaveBeenCalledWith('v-5508783', 'MCM565');
  });

  it('⚠️ OFFERS, never applies — nothing is written before the tap', () => {
    render(<KeytagReplateOffer vehicle={car()} tagPlate="MCM565" scanNonce={1} />);
    expect(adoptPlate).not.toHaveBeenCalled();
  });

  it('stays silent for a misread — one character off is a bad read, not a plate office visit', () => {
    render(<KeytagReplateOffer vehicle={car({ licensePlate: 'LUR254' })} tagPlate="LUR234" scanNonce={1} />);
    expect(screen.queryByText(/different plate/)).not.toBeInTheDocument();
  });

  it('renders nothing without a vehicle — a car FG has no record of has no plate to correct', () => {
    const { container } = render(<KeytagReplateOffer vehicle={null} tagPlate="MCM565" scanNonce={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the tag gave up no plate', () => {
    const { container } = render(<KeytagReplateOffer vehicle={car()} tagPlate={null} scanNonce={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
