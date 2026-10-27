// The Lot Lookout module. Aaron, 2026-10-15: *"What do you think of having lot outlook as an FG module?"* ...
// *"A now thing for us to polish"*. One screen: today's crew with the named list OPEN, the airport readings with live
// taps (migration 157), and the links — all signed in, no PIN. Erin St's count moved to the top bar's pill (2026-10-18).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CrewMember } from '../../src/lib/lotCrew';

const NOW = Date.parse('2026-10-15T23:30:00Z');
const member = (userId: string, name: string, role: CrewMember['role']): CrewMember =>
  ({ userId, name, role, start: '16:00', end: '22:00', more: [], out: false, onNow: true, phase: 'on' });

vi.mock('../../src/hooks/useLotAirport', () => ({
  useLotAirport: () => ({
    readings: { cleans: 0, cleansBy: 'LC', cleansAt: new Date(NOW - 14 * 60000).toISOString(), returns: 1, returnsBy: 'LC',
      returnsAt: new Date(NOW - 11 * 60000).toISOString(), aisle: true, aisleBy: 'LC', aisleAt: new Date(NOW - 11 * 60000).toISOString() },
    loaded: true, error: null, nowMs: NOW, setLocal: () => {},
  }),
}));
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({
    crew: { summary: { vsa: { on: 2, out: 0 }, driver: { on: 0, out: 0 } },
      members: [member('u1', 'Tomek', 'vsa'), member('u2', 'Khaiat', 'vsa')] },
    leaveOff: vi.fn(async () => null),
  }),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
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
    expect(screen.getByText('Tomek')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Who is where/ })).toBeNull();
  });

  it('⭐ the crew line is the schedule (2026-10-24): "2 on", and nothing to tap to keep it true', () => {
    render(<LotLookoutView />);
    expect(screen.getByRole('region', { name: 'Crew now' })).toHaveTextContent('VSAs 2 on');
    expect(screen.queryByRole('button', { name: /All to|Moving cars|Out$/ })).toBeNull();
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
});
