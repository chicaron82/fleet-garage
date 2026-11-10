// The Lot Lookout module, renovated into the bay log (2026-10-29; ticket-lot-lookout-bay-log). Aaron: *"removing the
// airport status and swatches making it strictly erin st / turning it into a VSA module for cleaning"*. One car in the
// bay, four exits, Erin St's count in the header's own blocks, today's list, the crew, the links. Signed in, no PIN.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CrewMember } from '../../src/lib/lotCrew';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const member = (userId: string, name: string, role: CrewMember['role']): CrewMember =>
  ({ userId, name, role, start: '16:00', end: '22:00', more: [], out: false, onNow: true, phase: 'on' });
const row = (over: Partial<BayLogRow>): BayLogRow => ({
  id: 6, vehicle_id: 'v-536', plate: 'LZM536', unit_number: '5423173', car: '2026 Toyota Corolla Cross · Gray', odometer: 20275,
  started_at: '2026-10-29T16:20:00.000Z', exit: null, exited_at: null, took_dirty: false, redo_of: null, note: null, hold_id: null, shift_day: '2026-10-29', ...over,
});

let rows: BayLogRow[] = [];
const exit = vi.fn(async (..._args: unknown[]) => null as string | null);
const undoExit = vi.fn(async () => null as string | null);
const start = vi.fn(async () => null as string | null);
const bump = vi.fn(async (..._args: unknown[]) => null as string | null);
const editRow = vi.fn(async (body: { id: number }) => ({ row: { ...rows.find(r => r.id === body.id)! } }) as { error: string } | { row: BayLogRow });
vi.mock('../../src/hooks/useBayLog', () => ({
  useBayLog: () => ({ rows, loaded: true, error: null, start, exit, undoExit, bump, editRow }),
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
const recordOdometer = vi.fn(async (..._args: unknown[]) => true);
const correctOdometer = vi.fn(async (..._args: unknown[]) => true);
let standbyState: { standby: Record<string, unknown> | null; loaded: boolean; load: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
const loadNext = vi.fn(async (..._args: unknown[]) => null as string | null);
const clearNext = vi.fn(async () => null as string | null);
vi.mock('../../src/hooks/useBayStandby', () => ({ useBayStandby: () => standbyState }));
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({
  holds, vehicles, archivedVehicles: [], recordOdometer, clearOdometer: vi.fn(), correctOdometer,
}) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const search = vi.fn();
vi.mock('../../src/context/scanRouter', () => ({ useScanRouter: () => ({ search }) }));

const { LotLookoutView } = await import('../../src/components/lot-lookout/LotLookoutView');

// The bay card's "Since" reads against now (ticket-lot-times-carry-the-day): pin now to the rows' own afternoon.
afterEach(() => { vi.useRealTimers(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T20:00:00Z'));
  rows = []; holds = []; vehicles = [seltos]; vi.clearAllMocks();
  standbyState = { standby: null, loaded: true, load: loadNext, clear: clearNext };
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
    fireEvent.click(screen.getByRole('button', { name: /^▶ Start clean$/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Onto the list/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean'));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoExit).toHaveBeenCalledWith(6));
  });

  // docs/ticket-bay-clean-sent-up-at-exit.md: *"Removes a dirty and doesn't +1 the clean"*.
  it('⭐ ✈ Clean · sent up: one tap, its own note, with an Undo', async () => {
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Clean · sent up/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'sent'));
    expect(await screen.findByText(/LZM536 clean · ✈ sent up · off the dirties/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  // ⭐ Aaron, 2026-11-03: *"Choosing M or B from the exit options after cleaning just marks them as M or B on the list.
  // Going through the form to fill everything out is costing me time."* (docs/ticket-bay-on-deck-trip-clean-quick-holds.md)
  for (const [name, kind] of [[/B hold/, 'bhold'], [/M hold/, 'mhold']] as const) {
    it(`⭐ ${kind}: one tap marks the list, no form, with an Undo`, async () => {
      rows = [row({})];
      const onNavigate = vi.fn();
      render(<LotLookoutView onNavigate={onNavigate} />);
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(exit).toHaveBeenCalledWith(6, kind));
      expect(onNavigate).not.toHaveBeenCalled();
      expect(await screen.findByText(`LZM536 ${kind === 'bhold' ? 'B' : 'M'} hold · flag it from the list`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await waitFor(() => expect(undoExit).toHaveBeenCalledWith(6));
    });
  }

  it('⭐ an M / B row with no hold flagged carries Flag it, which opens the form with the car and type chosen', () => {
    rows = [row({ id: 5, exit: 'bhold', exited_at: '2026-10-29T16:40:00.000Z' }), row({ id: 7, vehicle_id: 'v-9', plate: 'LUR560', exit: 'mhold', exited_at: '2026-10-29T16:50:00.000Z' })];
    // LUR560's hold was flagged after it went in: no Flag it on its row.
    holds = [{ vehicleId: 'v-9', flaggedAt: '2026-10-29T17:00:00.000Z', holdTypes: ['mechanical'] }];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    const flags = screen.getAllByRole('button', { name: 'Flag it →' });
    expect(flags).toHaveLength(1);
    fireEvent.click(flags[0]);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-hold', vehicleId: 'v-536', fromBay: 'bhold' }));
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

  it('⚠️ a hold from BEFORE the car went in is not this visit\'s, even with the start in Postgres\' spelling (d2441b18, pinned at /reflect 89)', () => {
    // As strings, "2026-10-29T16:15…Z" sorts after "2026-10-29 16:20:00+00" ('T' > ' '), which offered "Close it as held"
    // for an old hold. Compared as instants it is 5 minutes BEFORE the start.
    rows = [row({ started_at: '2026-10-29 16:20:00+00' })];
    holds = [{ vehicleId: 'v-536', flaggedAt: '2026-10-29T16:15:00.000Z', holdTypes: ['mechanical'] }];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Close it as held/ })).toBeNull();
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

  it('⭐ one outside link: the read-only view (the driver link went with the airport, Erin St\'s PIN count on 2026-11-05)', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getAllByRole('link', { name: 'Open' }).map(a => a.getAttribute('href'))).toEqual(['/lot/view']);
  });

  // ── first-shift friction (2026-10-31, docs/ticket-bay-log-first-shift-friction.md) ──
  // ⭐ Aaron: *"When I work passenger side I don't see the odo until I take it out to park"* → *"leaving the odo optional"*.
  it('⭐ Start cleaning works on a car with no odo today, and says so quietly', async () => {
    vehicles = [{ ...seltos, odometerAt: '2026-10-20T15:00:00.000Z' }];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    expect(screen.getByText('No odo today. The gas sheet can fill it in.')).toBeTruthy();
    const startBtn = screen.getByRole('button', { name: /^▶ Start clean$/ });
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
    expect(recordOdometer).toHaveBeenCalledWith('v-536', 21500);
    expect(recordOdometer.mock.invocationCallOrder[0]!).toBeLessThan(exit.mock.invocationCallOrder[0]!);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByText(/LZM536 clean · odo 21,500/)).toBeTruthy();
  });

  it('⭐ the box is optional: plain Clean closes the car and writes no reading', async () => {
    inNoOdo();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^✓ Clean/ }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean'));
    expect(recordOdometer).not.toHaveBeenCalled();
  });

  it('⚠️ a reading that did not save leaves the car in and says so', async () => {
    inNoOdo();
    recordOdometer.mockResolvedValueOnce(false);
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

  it('⭐ a number typed before Skip is logged, and one typed before a hold rides with it', async () => {
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
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'bhold', 21500));
    expect(recordOdometer).toHaveBeenCalledWith('v-536', 21500);
    expect(onNavigate).not.toHaveBeenCalled();
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

  // ── Next up (2026-11-02, migration 163, docs/ticket-bay-odo-in-card-and-next-up.md) ──
  // ⭐ Aaron: *"what if we entered standby plate for what is going to cleaned next"*.
  it('⭐ a car in the bay offers + Next up, whose search lines the picked car up', async () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ On deck' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    await waitFor(() => expect(loadNext).toHaveBeenCalledWith('v-487'));
    expect(start).not.toHaveBeenCalled();
  });

  it('a loaded car shows on the card, says when it comes in, and ✕ clears it', async () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    standbyState.standby = { vehicle_id: 'v-487', plate: '0GK487', unit_number: '5429550', car: '2026 Kia Seltos · Gray', shift_day: '2026-11-02' };
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'In the bay' });
    expect(card).toHaveTextContent('On deck');
    expect(card).toHaveTextContent('0GK487');
    expect(card).toHaveTextContent('Comes in when LZM536 leaves.');
    fireEvent.click(screen.getByRole('button', { name: 'Clear 0GK487 from on deck' }));
    await waitFor(() => expect(clearNext).toHaveBeenCalled());
  });

  it('⚠️ the bay empty with a car still loaded (a pull that failed) offers its Start, never a dead end', async () => {
    standbyState.standby = { vehicle_id: 'v-487', plate: '0GK487', unit_number: '5429550', car: null, shift_day: '2026-11-02' };
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Start cleaning 0GK487/ }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('v-487'));
  });

  it('an empty bay with nothing loaded has no Next up to offer', () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByText(/On deck/)).toBeNull();
  });

  // ⭐ Aaron, 2026-11-03: *"Split the large "start cleaning" into two options [Start Clean][On Deck]. On deck loads it as
  // the next vehicle"* (docs/ticket-bay-on-deck-trip-clean-quick-holds.md).
  it('⭐ the empty bay\'s Find a car: [▶ Start clean] [⏭ On deck]; On deck loads the car and starts nothing', async () => {
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    expect(screen.getByRole('button', { name: /^▶ Start clean$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '⏭ On deck' }));
    await waitFor(() => expect(loadNext).toHaveBeenCalledWith('v-487'));
    expect(start).not.toHaveBeenCalled();
  });

  it('a different car on deck: the line says On deck replaces it; this car on deck: ✓, nothing to tap', async () => {
    standbyState.standby = { vehicle_id: 'v-x', plate: 'LUR560', unit_number: null, car: null, shift_day: '2026-11-03' };
    const { unmount } = render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    fireEvent.click(await screen.findByRole('button', { name: /0GK487/ }));
    expect(screen.getByText('On deck replaces LUR560.')).toBeTruthy();
    unmount();
    standbyState.standby = { vehicle_id: 'v-487', plate: '0GK487', unit_number: null, car: null, shift_day: '2026-11-03' };
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Look up a vehicle/ }), { target: { value: '0GK487' } });
    // The on-deck card above the search names 0GK487 too (its Start and its ✕): pick the search's own result.
    fireEvent.click(await screen.findByRole('button', { name: /^(?!.*(Clear|Start)).*0GK487/ }));
    expect(screen.getByText('⏭ On deck ✓')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '⏭ On deck' })).toBeNull();
  });

  // ── Clean only, and Back to Next up (2026-11-03, docs/ticket-bay-clean-only-and-back-to-next-up.md) ──
  // ⭐ Aaron: *"When I tapped clean on the first it started the next. Problem, we had to do trips to the airport."*
  const loadSeltos = () => { standbyState.standby = { vehicle_id: 'v-487', plate: '0GK487', unit_number: '5429550', car: '2026 Kia Seltos · Gray', shift_day: '2026-11-03' }; };

  it('⭐ with a car on Next up, Clean says it comes in, and "Clean only" closes this one while it waits', async () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    loadSeltos();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^✓ Clean.*0GK487 comes in/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✓ Clean only · 0GK487 waits' }));
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'clean', undefined, false));
    expect(await screen.findByText(/LZM536 clean · on deck waits/)).toBeInTheDocument();
  });

  it('control: nothing on Next up, no "Clean only" and Clean promises nothing', () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Clean only/ })).toBeNull();
    expect(screen.queryByText(/comes in/)).toBeNull();
  });

  it('⭐ Back to Next up with the slot free: one tap, no exit, and the note says where the car went', async () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '↩ Back on deck · not cleaned' }));
    await waitFor(() => expect(bump).toHaveBeenCalledWith(6, false));
    expect(exit).not.toHaveBeenCalled();
    expect(await screen.findByText('LZM536 back on deck, not cleaned')).toBeInTheDocument();
  });

  it('⚠️ Back to Next up over a different car asks first: Keep sends nothing, Replace sends the yes', async () => {
    vehicles = [seltos, corolla];
    rows = [row({})];
    loadSeltos();
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '↩ Back on deck · not cleaned' }));
    expect(screen.getByRole('group', { name: 'Replace on deck' })).toHaveTextContent('0GK487 is on deck. Put LZM536 there instead?');
    expect(bump).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep 0GK487' }));
    expect(bump).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '↩ Back on deck · not cleaned' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace 0GK487' }));
    await waitFor(() => expect(bump).toHaveBeenCalledWith(6, true));
  });

  it('a number typed before Back to Next up is logged on the car first', async () => {
    vehicles = [seltos, { ...corolla, odometerAt: '2026-10-28T15:00:00.000Z' }];
    rows = [row({ odometer: null })];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Odometer reading' }), { target: { value: '21500' } });
    fireEvent.click(screen.getByRole('button', { name: '↩ Back on deck · not cleaned' }));
    await waitFor(() => expect(bump).toHaveBeenCalledWith(6, false));
    expect(recordOdometer).toHaveBeenCalledWith('v-536', 21500);
  });
});

// ── 2026-11-04 (docs/ticket-bay-erin-exit-notes-existing-hold.md): *"M, B, E, Skip"*, notes on the list, and Flag it
// offering the hold already on the car (*"going back to it later on the cleaned list"*).
describe('LotLookoutView — Erin, notes, the hold already on the car', () => {
  it('⭐ 🏠 Erin is one tap in the row of four, with an Undo', async () => {
    rows = [row({})];
    render(<LotLookoutView onNavigate={vi.fn()} />);
    const exits = ['M hold', 'B hold', '🏠 Erin', 'Skip'].map(n => screen.getByRole('button', { name: new RegExp(n) }));
    expect(exits[0].parentElement).toBe(exits[3].parentElement);
    fireEvent.click(exits[2]);
    await waitFor(() => expect(exit).toHaveBeenCalledWith(6, 'erin'));
    expect(await screen.findByText('LZM536 clean for Erin St · off the dirties')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(undoExit).toHaveBeenCalledWith(6));
  });

  it('⭐ + Note on a finished row saves through the one writer, and shows on the line', async () => {
    rows = [row({ id: 5, exit: 'clean', exited_at: '2026-10-29T16:40:00.000Z' })];
    const { rerender } = render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'keys in the cupholder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(editRow).toHaveBeenCalledWith({ action: 'bayNote', id: 5, note: 'keys in the cupholder' }));
    rows = [row({ id: 5, exit: 'clean', exited_at: '2026-10-29T16:40:00.000Z', note: 'keys in the cupholder' })];
    rerender(<LotLookoutView onNavigate={vi.fn()} />);
    expect(await screen.findByText('📝 keys in the cupholder')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Note' })).toBeNull();
  });

  it('a note that did not save stays in the box and says so', async () => {
    rows = [row({ id: 5, exit: 'clean', exited_at: '2026-10-29T16:40:00.000Z' })];
    editRow.mockResolvedValueOnce({ error: 'Sign in to FG to use the bay log.' });
    render(<LotLookoutView onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in to FG');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('x');
  });

  it('⭐ Flag it on a car already held offers "Same as the … hold", one tap, no form', async () => {
    rows = [row({ id: 5, exit: 'bhold', exited_at: '2026-10-29T16:40:00.000Z' })];
    holds = [{ id: 'h1', vehicleId: 'v-536', status: 'ACTIVE', flaggedAt: '2026-10-28T18:00:00.000Z', holdTypes: ['damage'] }];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flag it →' }));
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Same as the Oct 28 hold' }));
    await waitFor(() => expect(editRow).toHaveBeenCalledWith({ action: 'bayLinkHold', id: 5, holdId: 'h1' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('…and New hold → is still the form', () => {
    rows = [row({ id: 5, exit: 'bhold', exited_at: '2026-10-29T16:40:00.000Z' })];
    holds = [{ id: 'h1', vehicleId: 'v-536', status: 'ACTIVE', flaggedAt: '2026-10-28T18:00:00.000Z', holdTypes: ['damage'] }];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flag it →' }));
    fireEvent.click(screen.getByRole('button', { name: 'New hold →' }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-hold', vehicleId: 'v-536', fromBay: 'bhold' }));
  });

  it('a car whose only hold is the other kind, or closed, goes straight to the form', () => {
    rows = [row({ id: 5, exit: 'bhold', exited_at: '2026-10-29T16:40:00.000Z' })];
    holds = [
      { id: 'm', vehicleId: 'v-536', status: 'ACTIVE', flaggedAt: '2026-10-28T18:00:00.000Z', holdTypes: ['mechanical'] },
      { id: 'r', vehicleId: 'v-536', status: 'RELEASED', flaggedAt: '2026-10-27T18:00:00.000Z', holdTypes: ['damage'] },
    ];
    const onNavigate = vi.fn();
    render(<LotLookoutView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Flag it →' }));
    expect(screen.queryByRole('button', { name: /Same as/ })).toBeNull();
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-hold', fromBay: 'bhold' }));
  });
});

