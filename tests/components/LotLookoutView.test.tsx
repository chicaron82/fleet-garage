// The Lot Lookout module. Aaron, 2026-10-15: *"What do you think of having lot outlook as an FG module?"* ...
// *"A now thing for us to polish"*. One screen: today's crew with the named list OPEN, the airport readings with live
// taps (migration 157), and the links — all signed in, no PIN. Erin St's count moved to the top bar's pill (2026-10-18).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { CrewMember } from '../../src/lib/lotCrew';

const NOW = Date.parse('2026-10-15T23:30:00Z');
const member = (userId: string, name: string, role: CrewMember['role'], state: CrewMember['state']): CrewMember =>
  ({ userId, name, role, start: '16:00', end: '22:00', state, onNow: true, phase: 'on', marked: false });

vi.mock('../../src/hooks/useLotAirport', () => ({
  useLotAirport: () => ({
    readings: { cleans: 0, cleansBy: 'LC', cleansAt: new Date(NOW - 14 * 60000).toISOString(), returns: 1, returnsBy: 'LC',
      returnsAt: new Date(NOW - 11 * 60000).toISOString(), aisle: true, aisleBy: 'LC', aisleAt: new Date(NOW - 11 * 60000).toISOString() },
    loaded: true, error: null, nowMs: NOW, setLocal: () => {},
  }),
}));
const mark = vi.fn(async () => null);
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({
    crew: { summary: { vsa: { cleaning: 2, moving: 0, out: 0 }, driver: { airport: 0, other: 0, out: 0 } }, changedAt: null,
      members: [member('u1', 'Tomek', 'vsa', 'cleaning'), member('u2', 'Khaiat', 'vsa', 'cleaning')] },
    mark, leaveOff: vi.fn(async () => null),
  }),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const setShiftAttendance = vi.fn(async () => {});
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({
    todayShifts: [{ id: 's-tomek', userId: 'u1', shiftType: 'opening', attendance: undefined }, { id: 's-khaiat', userId: 'u2', shiftType: 'mid', attendance: 'present' }],
    setShiftAttendance,
  }),
}));
const tap = vi.fn();
let tapBy = '';
vi.mock('../../src/hooks/useAirportTaps', () => ({
  useAirportTaps: (o: { by: string; airport: { readings: unknown } }) => { tapBy = o.by; return { shown: o.airport.readings, waiting: 0, tap }; },
}));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

describe('LotLookoutView', () => {
  it('⭐ the airport readings take taps here, signed in as him (no PIN gate)', () => {
    render(<LotLookoutView />);
    expect(screen.queryByLabelText(/PIN/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cleans on the lot: Full' }));
    expect(tap).toHaveBeenCalledWith('cleans', 4);
    fireEvent.click(screen.getByRole('button', { name: 'Returns waiting: Clear' }));
    expect(tap).toHaveBeenCalledWith('returns', 4);
    fireEvent.click(screen.getByRole('button', { name: /Cars in the aisle/ }));
    expect(tap).toHaveBeenCalledWith('aisle', 0);
    expect(tapBy).toBe('AS');
  });

  it('no stall map anywhere (his ruling, 2026-10-18)', () => {
    render(<LotLookoutView />);
    expect(screen.queryByRole('button', { name: /^P3 / })).toBeNull();
    expect(screen.queryByText(/Hold a stall/)).toBeNull();
  });

  it('⭐ the named crew list is OPEN — no fold to find it behind', () => {
    render(<LotLookoutView />);
    expect(screen.getByRole('checkbox', { name: /Tomek/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All to moving cars' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Who is where/ })).toBeNull();
  });

  it('⭐ no Erin St section: the count lives in the top bar\'s pill now (2026-10-18)', () => {
    render(<LotLookoutView />);
    expect(screen.queryByRole('region', { name: 'Erin St' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Plus one clean/ })).toBeNull();
  });

  it('every outside link opens and copies', () => {
    render(<LotLookoutView />);
    expect(screen.getAllByRole('link', { name: 'Open' }).map(a => a.getAttribute('href'))).toEqual(['/lot', '/lot/erin', '/lot/view']);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
  });

  it('⭐ a crew chip here marks them on My Day too: a job is present, Out is a no-show (2026-10-18)', async () => {
    render(<LotLookoutView />);
    fireEvent.click(within(screen.getByRole('group', { name: /^Tomek:/ })).getByRole('button', { name: 'Moving cars' }));
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['u1'], 'moving', 'AS'));
    expect(setShiftAttendance).toHaveBeenCalledWith('s-tomek', 'present');
    setShiftAttendance.mockClear();
    fireEvent.click(within(screen.getByRole('group', { name: /^Khaiat:/ })).getByRole('button', { name: 'Out' }));
    await waitFor(() => expect(setShiftAttendance).toHaveBeenCalledWith('s-khaiat', 'absent'));
  });

  it('someone already marked present is not written again', async () => {
    setShiftAttendance.mockClear();
    render(<LotLookoutView />);
    fireEvent.click(within(screen.getByRole('group', { name: /^Khaiat:/ })).getByRole('button', { name: 'Moving cars' }));
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['u2'], 'moving', 'AS'));
    expect(setShiftAttendance).not.toHaveBeenCalled();
  });
});
