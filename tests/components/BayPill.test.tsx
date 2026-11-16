// The header bay pill (docs/ticket-header-bay-pill.md): off Lot Lookout, one tap finishes the clean, held 5 s with Undo,
// and a car held since it came in closes as held, never as a Clean.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const inBay = (): BayLogRow => ({
  id: 7, vehicle_id: 'v-LUR437', plate: 'LUR437', unit_number: null, car: 'Kia Seltos', odometer: null, took_dirty: false,
  redo_of: null, note: null, hold_id: null, shift_day: '2026-11-15', started_at: '2026-11-15T20:00:00.000Z', exit: null, exited_at: null,
} as BayLogRow);
let rows: BayLogRow[] = [];
let standby: { plate: string } | null = null;
let holds: { vehicleId: string; flaggedAt: string; holdTypes: string[] }[] = [];
const exit = vi.fn(async () => null as string | null);
vi.mock('../../src/hooks/useBayLog', () => ({ useBayLog: () => ({ rows, loaded: true, exit }) }));
vi.mock('../../src/hooks/useBayStandby', () => ({ useBayStandby: () => ({ standby, loaded: true }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ holds }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: () => {}, hapticMedium: () => {} }));

const { BayPill } = await import('../../src/components/layout/BayPill');
const onNavigate = vi.fn();
const pill = (activeModule: 'my-day' | 'lot-lookout' = 'my-day') => render(<BayPill activeModule={activeModule} onNavigate={onNavigate} />);
const after = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

beforeEach(() => { vi.useFakeTimers(); rows = [inBay()]; standby = null; holds = []; exit.mockClear(); exit.mockResolvedValue(null); onNavigate.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

describe('BayPill', () => {
  it('⭐ a car in the bay, off Lot Lookout: the pill shows the plate, no time', () => {
    pill();
    expect(screen.getByRole('button', { name: /LUR437 in the bay/ }).textContent).toBe('LUR437');
  });

  it('on Lot Lookout the card is right there: no pill', () => {
    const { container } = pill('lot-lookout');
    expect(container.textContent).toBe('');
  });

  it('an empty bay: no pill', () => {
    rows = [{ ...inBay(), exit: 'clean', exited_at: '2026-11-15T20:20:00.000Z' }];
    const { container } = pill();
    expect(container.textContent).toBe('');
  });

  it('⭐ a tap is held 5 s, then sends exactly one Clean, the car on deck named', async () => {
    standby = { plate: 'KUR261' };
    pill();
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean, KUR261 comes in/ }));
    expect(screen.getByRole('button', { name: 'LUR437 clean, KUR261 comes in. Undo' }).textContent).toBe('✓Undo');
    await after(4900);
    expect(exit).not.toHaveBeenCalled();
    await after(200);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(7, 'clean');
    expect(screen.getByRole('button', { name: '✓ KUR261 in' })).toBeTruthy();
  });

  it('⭐ Undo writes nothing', async () => {
    pill();
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean/ }));
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    await after(6000);
    expect(exit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /LUR437 in the bay/ }).textContent).toBe('LUR437');
  });

  it('a second tap while held sends nothing more (it is the Undo)', async () => {
    pill();
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean/ }));
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean/ }));
    await after(5100);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('⭐ held since it came in: the tap closes it as M, never as a Clean', async () => {
    holds = [{ vehicleId: 'v-LUR437', flaggedAt: '2026-11-15T20:10:00.000Z', holdTypes: ['mechanical'] }];
    pill();
    const b = screen.getByRole('button', { name: /held. Tap to close it as M hold/ });
    expect(b.textContent).toBe('🔧 LUR437');
    fireEvent.click(b);
    await after(5100);
    expect(exit).toHaveBeenCalledWith(7, 'mhold');
  });

  it('a held tap stays in the header even on Lot Lookout, until it lands', async () => {
    const { rerender } = pill();
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean/ }));
    rerender(<BayPill activeModule="lot-lookout" onNavigate={onNavigate} />);
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy();
    await after(5100);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('⭐ a failed write says so, and the next tap opens Lot Lookout', async () => {
    exit.mockResolvedValue('The bay log did not save. Try again.');
    pill();
    fireEvent.click(screen.getByRole('button', { name: /Tap to finish the clean/ }));
    await after(5100);
    fireEvent.click(screen.getByRole('button', { name: /did not save. Open Lot Lookout/ }));
    expect(onNavigate).toHaveBeenCalledWith({ name: 'lot-lookout' });
  });
});
