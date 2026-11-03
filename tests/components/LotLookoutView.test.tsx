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
const exit = vi.fn(async (..._args: unknown[]) => null as string | null);
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
  classCode: 'KSEL', rentalClass: 'D', status: 'CLEAR',
};
// The car the bay rows are about, when FG has it live (ticket-bay-log-first-shift-friction).
const corolla = {
  id: 'v-536', licensePlate: 'LZM536', unitNumber: '5423173', year: 2026, make: 'Toyota', model: 'Corolla Cross', color: 'Gray',
  isHybrid: false, isTesla: false, isUs: false, odometer: 20275, odometerAt: '2026-10-28T15:00:00.000Z',
  classCode: 'TCCR', rentalClass: 'F', status: 'CLEAR',
};
let vehicles: Record<string, unknown>[] = [seltos];
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
let holds: { vehicleId: string; flaggedAt: string; holdTypes: string[]; id?: string; status?: string; damageZones?: string[] }[] = [];
const logOdometer = vi.fn(async (..._args: unknown[]) => true);
const correctOdometer = vi.fn(async (..._args: unknown[]) => true);
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({
  holds, vehicles, archivedVehicles: [], recordOdometer: vi.fn(async () => {}), logOdometer, clearOdometer: vi.fn(), correctOdometer,
}) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const search = vi.fn();
vi.mock('../../src/context/scanRouter', () => ({ useScanRouter: () => ({ search }) }));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

beforeEach(() => {
  rows = []; holds = []; vehicles = [seltos]; vi.clearAllMocks();
  // ⚠️ clearAllMocks keeps a queued mockResolvedValueOnce. The "cannot place" test queues one its Enter path never
  // spends, and it answered the NEXT search anywhere in the file with no matches (found 2026-10-31). Reset it here.
  searchVehicles.mockReset();
  searchVehicles.mockImplementation(async () => ({ matches: [hit], failed: false }));
});

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

  // ── first-shift friction (2026-10-31, docs/ticket-bay-log-first-shift-friction.md) ──
  // ⭐ Aaron: *"When I work passenger side I don't see the odo until I take it out to park"* → *"leaving the odo optional"*.
  it('⭐ Start cleaning works on a car with no odo today, and says so quietly', async () => {
    vehicles = [{ ...seltos, odometerAt: '2026-10-20T15:00:00.000Z' }];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    expect(screen.getByText('No odo today. The gas sheet can fill it in.')).toBeTruthy();
    const startBtn = screen.getByRole('button', { name: /Start cleaning/ });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    await waitFor(() => expect(start).toHaveBeenCalledWith('v-487'));
  });

  // ⭐ *"Also displaying the same info as the find a car / Unit# model code, class code"*.
  it('⭐ the pick card wears the popup\'s header: Unit #, the codes line, the status; a tap opens the record', async () => {
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('0GK487 · Unit 542 9550');
    expect(card).toHaveTextContent('KSEL · class D');
    expect(card).toHaveTextContent('Clear');
    expect(screen.getByRole('button', { name: '← Different car' })).toBeTruthy();
    fireEvent.click(screen.getByTitle('Open the record'));
    expect(onNavigate).toHaveBeenCalledWith({ name: 'vehicle', vehicleId: 'v-487' });
  });

  it('⭐ the In the bay card wears it too, looked up live; the row\'s odo shows only when it has one', () => {
    vehicles = [seltos, corolla];
    rows = [row({ odometer: null })];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('LZM536 · Unit 542 3173');
    expect(card).toHaveTextContent('TCCR · class F');
    expect(card).toHaveTextContent('Since 11:20');
    expect(screen.getByText('Since 11:20')).toBeTruthy();   // no "· odo" on a row without today's reading
    fireEvent.click(screen.getByTitle('Open the record'));
    expect(onNavigate).toHaveBeenCalledWith({ name: 'vehicle', vehicleId: 'v-536' });
  });

  it('a bay car FG no longer has live falls back to the row\'s own plate and car line', () => {
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('LZM536');
    expect(card).toHaveTextContent('2026 Toyota Corolla Cross · Gray');
    expect(card).toHaveTextContent('odo 20,275');
    expect(screen.queryByTitle('Open the record')).toBeNull();
  });

  // ⭐ *"I don't see the damage map and did miss marking damage on a few"*.
  it('⭐ the damage map rides on both bay cards for a car with zones, and stays silent on a clear one', async () => {
    vehicles = [seltos, corolla];
    holds = [{ id: 'h1', vehicleId: 'v-536', status: 'ACTIVE', holdTypes: ['damage'], flaggedAt: '2026-10-01T12:00:00Z', damageZones: ['front-bumper'] }];
    rows = [row({})];
    const { unmount } = render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'In the bay' })).toContainElement(screen.getByTestId('scan-damage-zones'));
    expect(screen.getByText('Front bumper')).toBeTruthy();
    unmount();

    rows = [];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    expect(screen.queryByTestId('scan-damage-zones')).toBeNull();      // the clear Seltos: nothing
  });

  // ── the odo from the car in the bay (2026-11-02, docs/ticket-bay-odo-in-card-and-next-up.md) ──
  // ⭐ Aaron: *"entering the odo when a cleaning has started then logging it stops the clean"*.
  const inNoOdo = () => { vehicles = [seltos, corolla]; rows = [row({ odometer: null })]; };
  const odoBox = () => screen.getByRole('textbox', { name: 'Odometer reading' });
  const type = (v: string) => fireEvent.change(odoBox(), { target: { value: v } });

  it('⭐ a typed reading turns Clean into "log": one tap saves the reading, THEN closes the car, with an Undo', async () => {
    inNoOdo();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    type('21,500');
    fireEvent.click(screen.getByRole('button', { name: /Clean · log 21,500 km/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean', 21500));
    expect(logOdometer).toHaveBeenCalledWith('v-536', 21500);
    expect(logOdometer.mock.invocationCallOrder[0]!).toBeLessThan(exit.mock.invocationCallOrder[0]!);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByText(/LZM536 clean · odo 21,500/)).toBeTruthy();
  });

  it('⭐ the box is optional: plain Clean closes the car and writes no reading', async () => {
    inNoOdo();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^✓ Clean/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean'));
    expect(logOdometer).not.toHaveBeenCalled();
  });

  it('⚠️ a reading that did not save leaves the car in and says so', async () => {
    inNoOdo();
    logOdometer.mockResolvedValueOnce(false);
    render(<LotLookoutView onNavigate={vi.fn()} />);
    type('21500');
    fireEvent.click(screen.getByRole('button', { name: /Clean · log/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/did not save/);
    expect(exit).not.toHaveBeenCalled();
    expect(odoBox()).toHaveValue('21500');   // what he typed is still there
  });

  it('⚠️ a lower reading holds every exit until he corrects the record or clears the box', async () => {
    inNoOdo();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    type('19000');
    for (const name of [/^✓ Clean/, /M hold/, /B hold/, /Skip/]) expect(screen.getByRole('button', { name })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Correct it to 19,000 km/ }));
    await waitFor(() => expect(correctOdometer).toHaveBeenCalledWith('v-536', 19000));
    type('');
    expect(screen.getByRole('button', { name: /^✓ Clean/ })).not.toBeDisabled();
  });

  it('an unreadable number holds the exits too', () => {
    inNoOdo();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    type('12a');
    expect(screen.getByRole('button', { name: /^✓ Clean/ })).toBeDisabled();
    expect(screen.getByText(/isn't a reading/)).toBeTruthy();
  });

  it('⭐ a number typed before Skip is logged, and one typed before a hold is logged before the form opens', async () => {
    inNoOdo();
    const onNavigate = vi.fn();
    const { unmount } = render(<LotLookoutView onNavigate={onNavigate} />);
    type('21500');
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'skip', 21500));
    unmount();
    vi.clearAllMocks();
    render(<LotLookoutView onNavigate={onNavigate} />);
    type('21500');
    fireEvent.click(screen.getByRole('button', { name: /B hold/ }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-hold', bayExit: { id: 6, kind: 'bhold' } })));
    expect(logOdometer).toHaveBeenCalledWith('v-536', 21500);
  });

  it('no box once today has a reading: from the Start, or logged on the car since', () => {
    vehicles = [seltos, corolla];
    rows = [row({ odometer: 20275 })];
    const { unmount } = render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: 'Odometer reading' })).toBeNull();
    unmount();
    vehicles = [seltos, { ...corolla, odometer: 21500, odometerAt: new Date().toISOString() }];
    rows = [row({ odometer: null })];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: 'Odometer reading' })).toBeNull();
    expect(screen.getByText('Since 11:20 · odo 21,500')).toBeTruthy();
  });
});
