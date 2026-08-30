import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Undoing a change-log entry. Built after a key-tag scan of LUR443 landed on LUR243's record and
// overwrote eleven fields; the log had every previous value and putting them back was hand work.

const revertVehicleChange = vi.fn().mockResolvedValue(undefined);
let ROWS: { changedAt: string; op: 'UPDATE' | 'DELETE'; changed: Record<string, unknown>; actor?: string | null }[] = [];

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ revertVehicleChange }),
}));
// The refresh key is the observable signal that the component asked for a fresh read.
let lastRefreshKey = 0;
vi.mock('../../src/hooks/useVehicleChanges', () => ({
  useVehicleChanges: (_id: string, refreshKey = 0) => { lastRefreshKey = refreshKey; return ROWS; },
}));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('../../src/context/ProfilesContext', () => ({
  useProfiles: () => new Map([['u-aaron', { id: 'u-aaron', name: 'Aaron S.' }]]),
}));

import { VehicleChangeLog } from '../../src/components/vehicle/VehicleChangeLog';

const SCAN = {
  changedAt: '2026-08-22T20:30:00Z',
  op: 'UPDATE' as const,
  changed: { make: { from: 'Nissan', to: 'Dodge' }, model: { from: 'Versa', to: 'Durango' } },
};

const openLog = () => fireEvent.click(screen.getByRole('button', { name: /record change/i }));
beforeEach(() => { revertVehicleChange.mockClear(); revertVehicleChange.mockResolvedValue(undefined); });

describe('VehicleChangeLog — undo', () => {
  it('⭐ arms before it writes — one tap never reverts anything', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(revertVehicleChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Undo these 2 changes\?/ })).toBeInTheDocument();
  });

  it('passes the entry through untouched on confirm', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    expect(revertVehicleChange).toHaveBeenCalledWith('veh-1', SCAN.changed, 'UPDATE');
  });

  it('can be backed out of', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(revertVehicleChange).not.toHaveBeenCalled();
  });

  it('⭐⭐ SHOWS the refusal instead of swallowing it', () => {
    // "colour has changed since" is the useful half — it tells him someone corrected this after,
    // which is exactly the thing he needs to know before touching it again.
    revertVehicleChange.mockRejectedValueOnce(new Error('color has changed since — undoing this would overwrite that.'));
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    return waitFor(() => expect(screen.getByText(/color has changed since/)).toBeInTheDocument());
  });

  it('offers nothing to undo on a DELETE entry', () => {
    ROWS = [{ changedAt: '2026-08-22T20:30:00Z', op: 'DELETE', changed: { make: 'Nissan', model: 'Versa' } }];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('stays silent when the car has no trail at all', () => {
    ROWS = [];
    const { container } = render(<VehicleChangeLog vehicleId="veh-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VehicleChangeLog — the trail after an undo', () => {
  it('⭐ asks for a FRESH read once the undo succeeds', async () => {
    // The revert WRITES a new entry (the same trigger records it). Without a re-read the trail goes
    // stale the moment he uses it — still showing the entry he just undid, still offering to undo
    // it, and a second tap would refuse with a message about his own correction.
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    const before = lastRefreshKey;
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    await waitFor(() => expect(lastRefreshKey).toBe(before + 1));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();   // disarmed again
  });

  it('does NOT re-read when the undo was refused', async () => {
    // A refusal changed nothing, so re-reading would only make the log flicker for no reason.
    revertVehicleChange.mockRejectedValueOnce(new Error('color has changed since'));
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    const before = lastRefreshKey;
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    await waitFor(() => expect(screen.getByText(/color has changed since/)).toBeInTheDocument());
    expect(lastRefreshKey).toBe(before);
  });
});

// ⭐ WHO — migration 132, and the discipline that came with it.
describe('VehicleChangeLog — naming the actor', () => {
  it('⭐ says who made the change when the row knows', () => {
    ROWS = [{ ...SCAN, actor: 'dizee' }];
    render(<VehicleChangeLog vehicleId="v1" />);
    openLog();
    expect(screen.getByText(/· by DiZee/)).toBeInTheDocument();
  });

  it('resolves an app user id through the profiles map', () => {
    ROWS = [{ ...SCAN, actor: 'u-aaron' }];
    render(<VehicleChangeLog vehicleId="v1" />);
    openLog();
    expect(screen.getByText(/· by Aaron S\./)).toBeInTheDocument();
  });

  // ⚠️ THE RULE THAT OUTLIVED ITS OWN LIMITATION. Every row before 132 has a null actor, and a
  // trail that quietly implies a person is worse than one that admits it does not know. So a
  // historic row must render exactly as it always did — no "unknown", no "system", no raw id.
  it('⚠️ says nothing at all for a historic row with no actor', () => {
    ROWS = [{ ...SCAN, actor: null }];
    const { container } = render(<VehicleChangeLog vehicleId="v1" />);
    openLog();
    expect(container.textContent).not.toMatch(/· by/);
    expect(container.textContent).not.toMatch(/unknown|system/i);
  });
});
