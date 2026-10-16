// The Lot Lookout module. Aaron, 2026-10-15: *"What do you think of having lot outlook as an FG module?"* ...
// *"A now thing for us to polish"*. One screen: Erin St's count, today's crew with the named list OPEN, the airport
// board with live taps, and the links — all signed in, no PIN.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LotStall } from '../../src/lib/lotLookout';
import type { CrewMember } from '../../src/lib/lotCrew';

const NOW = Date.parse('2026-10-15T23:30:00Z');
const stalls: LotStall[] = [{ stall: 'P3', run: 'P', num: 3, state: 'clean', tappedBy: 'LC', tappedAt: new Date(NOW).toISOString() }];
const member = (userId: string, name: string, role: CrewMember['role'], state: CrewMember['state']): CrewMember =>
  ({ userId, name, role, start: '16:00', end: '22:00', state, onNow: true, phase: 'on', marked: false });

vi.mock('../../src/hooks/useLotBoard', () => ({
  useLotBoard: () => ({ stalls, aisle: { cars: 0, tappedBy: null, tappedAt: null }, loaded: true, error: null, nowMs: NOW }),
}));
vi.mock('../../src/hooks/useLotBay', () => ({
  useLotBay: () => ({
    bay: { cleans: 4, cleansBy: 'AS', cleansAt: new Date(NOW).toISOString(), dirties: 2, dirtiesBy: 'AS', dirtiesAt: new Date(NOW).toISOString(), used: 0, usedOn: null },
    log: [], loaded: true, nowMs: NOW, setBay: () => {},
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
const tapCleans = vi.fn();
vi.mock('../../src/hooks/useBayTaps', () => ({ useBayTapsSignedIn: () => ({ tapCleans, setDirties: vi.fn(async () => true) }) }));
const tapStall = vi.fn();
const tapAisle = vi.fn();
let stallBy = '';
vi.mock('../../src/hooks/useLotTaps', () => ({
  useLotTapsSignedIn: (_b: unknown, _t: unknown, by: string) => { stallBy = by; return { tapStall, tapAisle }; },
}));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

describe('LotLookoutView', () => {
  it('⭐ the airport board takes taps here, signed in as him (no PIN gate)', () => {
    render(<LotLookoutView />);
    expect(screen.queryByLabelText(/PIN/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'P3 dirty' }));
    expect(tapStall).toHaveBeenCalledWith('P3', 'dirty');
    fireEvent.click(screen.getByRole('button', { name: 'One more in the aisle' }));
    expect(tapAisle).toHaveBeenCalledWith(1);
    expect(stallBy).toBe('AS');
  });

  it('⭐ the named crew list is OPEN — no fold to find it behind', () => {
    render(<LotLookoutView />);
    expect(screen.getByRole('checkbox', { name: /Tomek/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All to moving cars' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Who is where/ })).toBeNull();
  });

  it('Erin St\'s steppers work here too', () => {
    render(<LotLookoutView />);
    fireEvent.click(screen.getByRole('button', { name: /Plus one clean/ }));
    expect(tapCleans).toHaveBeenCalledWith(1);
  });

  it('every outside link opens and copies', () => {
    render(<LotLookoutView />);
    expect(screen.getAllByRole('link', { name: 'Open' }).map(a => a.getAttribute('href'))).toEqual(['/lot', '/lot/erin', '/lot/view']);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
  });
});
