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
vi.mock('../../src/hooks/useBayLog', () => ({
  useBayLog: () => ({ rows, loaded: true, error: null, start: vi.fn(), exit, undoExit }),
}));
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
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ holds }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const search = vi.fn();
vi.mock('../../src/context/scanRouter', () => ({ useScanRouter: () => ({ search }) }));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

beforeEach(() => { rows = []; holds = []; exit.mockClear(); undoExit.mockClear(); search.mockClear(); });

describe('LotLookoutView — the bay log', () => {
  it('⭐ strictly Erin St: no airport anywhere', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByText(/Airport/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Cleans on the lot:/ })).toBeNull();
  });

  it('an empty bay leads with Find a car', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getByText("The bay's empty.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Find a car/ }));
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
