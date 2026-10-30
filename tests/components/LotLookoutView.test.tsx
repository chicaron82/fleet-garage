// The Lot Lookout module, renovated into the bay log (2026-10-29; ticket-lot-lookout-bay-log). Aaron: *"removing the
// airport status and swatches making it strictly erin st / turning it into a VSA module for cleaning"*. One car in the
// bay, four exits, Erin St's count in the header's own blocks, today's list, the crew, the links. Signed in, no PIN.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CrewMember } from '../../src/lib/lotCrew';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const member = (userId: string, name: string, role: CrewMember['role']): CrewMember =>
  ({ userId, name, role, start: '16:00', end: '22:00', more: [], out: false, onNow: true, phase: 'on' });
const row = (over: Partial<BayLogRow>): BayLogRow => ({
  id: 6, vehicle_id: 'v-536', plate: 'LZM536', unit_number: '5423173', car: '2026 Toyota Corolla Cross · Gray', odometer: 20275,
  started_at: '2026-10-29T16:20:00.000Z', exit: null, exited_at: null, took_dirty: false, redo_of: null, shift_day: '2026-10-29', ...over,
});

let rows: BayLogRow[] = [];
const exit = vi.fn(async () => null as string | null);
const undoExit = vi.fn(async () => null as string | null);
const start = vi.fn(async () => null as string | null);
vi.mock('../../src/hooks/useBayLog', () => ({
  useBayLog: () => ({ rows, loaded: true, error: null, start, exit, undoExit }),
}));
// The empty bay's own Find a car (ticket-bay-find-a-car-inline-search): the lookup's network search and its recents.
const hit = { license_plate: '0GK487', unit_number: '5429550', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray', is_hybrid: false, is_tesla: false, archived_at: null };
const searchVehicles = vi.fn(async (_q: string) => ({ matches: [hit], failed: false }));
vi.mock('../../src/lib/ev-detection', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/lib/ev-detection')>()), searchVehicles: (q: string) => searchVehicles(q),
}));
const recordLookup = vi.fn();
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents: [], record: recordLookup }) }));
const seltos = {
  id: 'v-487', licensePlate: '0GK487', unitNumber: '5429550', year: 2026, make: 'Kia', model: 'Seltos', color: 'Gray',
  isHybrid: false, isTesla: false, isUs: false, odometer: 14315, odometerAt: new Date().toISOString(),
};
vi.mock('../../src/hooks/useLotBay', () => ({
  useLotBay: () => ({ bay: { cleans: 12, cleansBy: 'AS', cleansAt: null, dirties: 9, dirtiesBy: 'AS', dirtiesAt: null, used: 0, usedOn: null },
    log: [], loaded: true, nowMs: Date.parse('2026-10-29T16:30:00Z'), setBay: () => {} }),
}));
vi.mock('../../src/hooks/useBayTaps', () => ({
  useBayTapsSignedIn: () => ({ tapCleans: vi.fn(), stepDirties: vi.fn(), setCount: vi.fn(async () => true), drain: vi.fn(), fill: vi.fn() }),
}));
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({
    crew: { summary: { vsa: { on: 2, out: 0 }, driver: { on: 3, out: 0 } },
      members: [member('u1', 'Tomek', 'vsa'), member('u2', 'Khaiat', 'vsa')] },
    leaveOff: vi.fn(async () => null),
  }),
}));
let holds: { vehicleId: string; flaggedAt: string; holdTypes: string[] }[] = [];
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({
  holds, vehicles: [seltos], archivedVehicles: [], recordOdometer: vi.fn(async () => {}), clearOdometer: vi.fn(), correctOdometer: vi.fn(),
}) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const search = vi.fn();
vi.mock('../../src/context/scanRouter', () => ({ useScanRouter: () => ({ search }) }));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

beforeEach(() => { rows = []; holds = []; vi.clearAllMocks(); });

describe('LotLookoutView — the bay log', () => {
  it('⭐ strictly Erin St: no airport anywhere', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByText(/Airport/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Cleans on the lot:/ })).toBeNull();
  });

  // ⭐ Aaron, 2026-10-29: *"i'm already in the module ... that button should be the input search box"*.
  it('⭐ an empty bay leads with the search box itself, in the card: nothing floats, and no keyboard on load', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent("The bay's empty.");
    const box = screen.getByRole('textbox', { name: /Look up a vehicle/ });
    expect(card.contains(box)).toBe(true);
    expect(document.activeElement).not.toBe(box);
    expect(screen.queryByRole('button', { name: /🔍 Find a car/ })).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  it('⭐ OGK487 finds 0GK487 in the card, and picking it goes straight to its odo and Start cleaning', async () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: 'OGK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('0GK487');
    expect(screen.getByRole('textbox', { name: 'Odometer reading' })).toBeTruthy();
    expect(recordLookup).toHaveBeenCalledWith('v-487');
    fireEvent.click(screen.getByRole('button', { name: /Start cleaning/ }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('v-487'));
    expect(search).not.toHaveBeenCalled();
  });

  it('a key FG cannot place hands off to the full 🔍 popup, never a dead end', async () => {
    searchVehicles.mockResolvedValueOnce({ matches: [], failed: false });
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const box = screen.getByRole('textbox', { name: /Look up a vehicle/ });
    fireEvent.change(box, { target: { value: 'ZZZ999' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /isn't a car in FG/ }));
    expect(search).toHaveBeenCalled();
  });

  it('⭐ the car in the bay, and Clean puts it on the list with an Undo', async () => {
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('LZM536');
    expect(card).toHaveTextContent('Since 11:20');
    fireEvent.click(screen.getByRole('button', { name: /Clean/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean'));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoExit).toHaveBeenCalledWith(6));
  });

  it('⭐ B hold and M hold open Flag / hold for this car, with the exit riding along', () => {
    rows = [row({})];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /B hold/ }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-hold', vehicleId: 'v-536', bayExit: { id: 6, kind: 'bhold' } }));
    fireEvent.click(screen.getByRole('button', { name: /M hold/ }));
    expect(onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ bayExit: { id: 6, kind: 'mhold' } }));
    expect(exit).not.toHaveBeenCalled();
  });

  it('⚠️ a hold already saved on the car (its close did not land): close it as held, never a second hold', async () => {
    rows = [row({})];
    holds = [{ vehicleId: 'v-536', flaggedAt: '2026-10-29T16:40:00.000Z', holdTypes: ['mechanical'] }];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    expect(screen.queryByRole('button', { name: /B hold/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Close it as held/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'mhold'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('Skip bumps it, and the empty bay says what comes next', async () => {
    rows = [row({})];
    const { rerender } = render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'skip'));
    rows = [row({ exit: 'skip', exited_at: '2026-10-29T16:25:00.000Z' })];
    rerender(<LotLookoutView onNavigate={vi.fn()} />);
    expect(await screen.findByText('Bumped. Bring the ASAP car in.')).toBeTruthy();
  });

  it('⭐ Erin St wears the header sheet\'s own blocks (*"use the same style as the header"*)', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Cleans' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dirties' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /drain 3/ })).toBeTruthy();
  });

  it('⭐ the named crew list is OPEN; the crew line is the schedule', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getByText('Tomek')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Crew now' })).toHaveTextContent('VSAs 2 on');
  });

  it('the outside links: Erin St\'s count and the read-only view (the driver link went with the airport)', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('link', { name: 'Open' }).map(a => a.getAttribute('href'))).toEqual(['/lot/erin', '/lot/view']);
  });
});
