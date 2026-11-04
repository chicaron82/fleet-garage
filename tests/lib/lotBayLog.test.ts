import { describe, it, expect } from 'vitest';
import { sameHoldChoices, sameHoldLabel, bayLines, bayMarkLine, bayMarkOf, bayOdoEntry, bayOdoLetsExit, bayReportLine, baySummary, inTheBay, isUnflaggedHold, startBlock, unflaggedHoldIds, vehicleForPick, type BayLogRow } from '../../src/lib/lotBayLog';

// Times are UTC; clockOf prints Winnipeg (CDT, UTC−5 on 2026-10-29).
const row = (id: number, plate: string, start: string, exit: BayLogRow['exit'], exitAt: string | null, extra: Partial<BayLogRow> = {}): BayLogRow => ({
  id, vehicle_id: `v-${plate}`, plate, unit_number: null, car: 'Kia Seltos · Gray', odometer: 1, took_dirty: false, redo_of: null, note: null, hold_id: null,
  shift_day: '2026-10-29', started_at: `2026-10-29T${start}:00.000Z`, exit, exited_at: exitAt ? `2026-10-29T${exitAt}:00.000Z` : null, ...extra,
});

const DAY = [
  row(1, 'LUR183', '12:02', 'clean', '12:31'),
  row(2, '0DM137', '13:10', 'bhold', '13:40'),
  row(3, 'MCN139', '14:30', 'skip', '14:48'),
  row(4, 'LUR352', '15:00', 'mhold', '16:05'),
  row(5, 'MCN139', '15:40', 'clean', '15:55', { redo_of: 3 }),
  row(6, 'LZM536', '16:20', null, null),
];

describe('bayLines', () => {
  const lines = bayLines(DAY);
  it('in the order the cars went in', () => {
    expect(lines.map(l => l.plate)).toEqual(['LUR183', '0DM137', 'MCN139', 'LUR352', 'MCN139', 'LZM536']);
  });
  it('⚠️ a finished car shows its EXIT time only (durations, never)', () => {
    expect(lines[0]).toMatchObject({ time: '07:31', kind: 'clean', label: 'Clean', note: '' });
    expect(lines.some(l => /min|start/i.test(`${l.note}${l.label}`))).toBe(false);
  });
  it('the car in the bay shows since when', () => {
    expect(lines[5]).toMatchObject({ time: '11:20', kind: 'bay', label: 'In the bay', note: 'since 11:20' });
  });
  it('a bump and its redo are tied together', () => {
    expect(lines[2]).toMatchObject({ kind: 'skip', label: 'Bumped', note: 'redone 10:55' });
    expect(lines[4]).toMatchObject({ kind: 'clean', note: 'was bumped' });
  });
  it('holds say which kind', () => {
    expect(lines[1]).toMatchObject({ label: 'B hold', note: 'damage' });
    expect(lines[3]).toMatchObject({ label: 'M hold', note: 'mechanical' });
  });
  it('the read-only link says "Held" (the hold itself stays in FG)', () => {
    const ro = bayLines(DAY, { readOnly: true });
    expect(ro[1]).toMatchObject({ label: 'Held', note: 'damage' });
    expect(ro[3]).toMatchObject({ label: 'Held', note: 'mechanical' });
  });
  it('a bumped car still waiting says so; back in the bay says that', () => {
    expect(bayLines([row(3, 'MCN139', '14:30', 'skip', '14:48')])[0].note).toBe('still to do');
    expect(bayLines([row(3, 'MCN139', '14:30', 'skip', '14:48'), row(5, 'MCN139', '15:40', null, null, { redo_of: 3 })])[0].note).toBe('back in the bay');
    expect(bayLines([row(3, 'MCN139', '14:30', 'skip', '14:48'), row(5, 'MCN139', '15:40', 'skip', '15:50', { redo_of: 3 })])[0].note).toBe('bumped again');
  });
});

describe('baySummary', () => {
  it('counts the day', () => {
    expect(baySummary(DAY)).toEqual({ clean: 2, erin: 0, mhold: 1, bhold: 1, stillToDo: 0 });
  });
  it('a bump waits until its restart; bumped twice is still ONE car to do', () => {
    expect(baySummary([row(3, 'X', '14:30', 'skip', '14:48')]).stillToDo).toBe(1);
    expect(baySummary([row(3, 'X', '14:30', 'skip', '14:48'), row(5, 'X', '15:40', 'skip', '15:50', { redo_of: 3 })]).stillToDo).toBe(1);
  });
});

describe('the one-car gate', () => {
  it('finds the car in the bay', () => {
    expect(inTheBay(DAY)?.plate).toBe('LZM536');
    expect(inTheBay(DAY.slice(0, 5))).toBeNull();
  });
  it('blocks a Start while a car is in, and knows if it is the same car', () => {
    expect(startBlock(null, 'v-X')).toBeNull();
    expect(startBlock(DAY[5], 'v-LUR407')).toEqual({ plate: 'LZM536', since: '11:20', same: false });
    expect(startBlock(DAY[5], 'v-LZM536')).toMatchObject({ same: true });
  });
});

// The bay card's own Find a car (docs/ticket-bay-find-a-car-inline-search.md): which FG record did he pick or type?
describe('vehicleForPick', () => {
  const fleet = [
    { id: 'a', licensePlate: '0GK487', unitNumber: '5429550' },
    { id: 'b', licensePlate: 'LUR486', unitNumber: '5429592' },
    { id: 'c', licensePlate: 'LUR486', unitNumber: 'HRZ-3307' }, // a mock beside the real car shares the plate
  ];
  it('a picked suggestion is that record, plate AND unit, never the mock that shares its plate', () => {
    expect(vehicleForPick(fleet, { plate: 'LUR486', unit: '5429592' })?.id).toBe('b');
  });
  it('⭐ typed and committed: the whole plate, O read as 0', () => {
    expect(vehicleForPick(fleet, { typed: 'OGK487' })?.id).toBe('a');
    expect(vehicleForPick(fleet, { typed: '0gk487' })?.id).toBe('a');
  });
  it('typed: the whole unit number finds its car', () => {
    expect(vehicleForPick(fleet, { typed: '5429550' })?.id).toBe('a');
  });
  it('a fragment typed and committed is not a car: it needs the list, so null', () => {
    expect(vehicleForPick(fleet, { typed: 'GK48' })).toBeNull();
    expect(vehicleForPick(fleet, { typed: 'ZZZ999' })).toBeNull();
  });
});


describe('bayReportLine (the shift report)', () => {
  it('counts, zeros hidden; a bumped car that was redone is not still to do', () => {
    expect(bayReportLine(DAY)).toBe('2 clean · 1 B hold · 1 M hold');
    expect(bayReportLine([row(1, 'A', '12:00', 'clean', '12:30'), row(2, 'B', '13:00', 'skip', '13:10')])).toBe('1 clean · 1 bumped, still to do');
  });
  it('a day with no cars has no line', () => { expect(bayReportLine([])).toBeNull(); });
});

describe('bayOdoEntry (the bay card\'s odo box)', () => {
  it('empty lets the car go; a forward or first reading logs; the same reading is nothing to log', () => {
    expect(bayOdoEntry('  ', 20000)).toEqual({ kind: 'empty' });
    expect(bayOdoEntry('21,500', 20000)).toEqual({ kind: 'log', km: 21500 });
    expect(bayOdoEntry('21500', null)).toEqual({ kind: 'log', km: 21500 });
    expect(bayOdoEntry('20000', 20000)).toEqual({ kind: 'same', km: 20000 });
    for (const d of ['', '21500', '20000']) expect(bayOdoLetsExit(bayOdoEntry(d, 20000))).toBe(true);
  });
  it('⚠️ a lower or unreadable number holds the exits, never dropped silently', () => {
    expect(bayOdoEntry('19000', 20000)).toEqual({ kind: 'lower', km: 19000 });
    for (const d of ['12a', '0', '12345678']) expect(bayOdoEntry(d, 20000)).toEqual({ kind: 'unreadable' });
    for (const d of ['19000', '12a']) expect(bayOdoLetsExit(bayOdoEntry(d, 20000))).toBe(false);
  });
});

// M / B as one tap (Aaron, 2026-11-03: *"just marks them as M or B on the list"*). The list carries the mark; FG's hold is
// still the only word that the car is held, so the mark says "not flagged yet" until one is.
describe('a hold mark not yet flagged', () => {
  const held = (vehicleId: string, at: string) => ({ vehicleId, flaggedAt: at });
  it('⭐ a hold exit with no hold on the car since it went in is unflagged; one flagged after the start clears it', () => {
    expect(isUnflaggedHold(DAY[1], [])).toBe(true);
    expect(isUnflaggedHold(DAY[1], [held('v-0DM137', '2026-10-29T14:00:00.000Z')])).toBe(false);
    // Postgres spells the same instant differently: still compared as an instant.
    expect(isUnflaggedHold(DAY[1], [held('v-0DM137', '2026-10-29T13:10:00+00:00')])).toBe(false);
  });
  it('⚠️ an OLD hold (before this car went in) or another car\'s hold does not count', () => {
    expect(isUnflaggedHold(DAY[1], [held('v-0DM137', '2026-10-20T14:00:00.000Z'), held('v-LUR352', '2026-10-29T14:00:00.000Z')])).toBe(true);
  });
  it('a Clean, Skip, or the car still in the bay is never a mark', () => {
    expect([DAY[0], DAY[2], DAY[5]].map(r => isUnflaggedHold(r, []))).toEqual([false, false, false]);
  });
  it('the day\'s Flag it rows', () => {
    expect([...unflaggedHoldIds(DAY, [held('v-LUR352', '2026-10-29T16:10:00.000Z')])]).toEqual([2]);
  });
  it('⭐ Find a car reads the LATEST finished row: the mark, until a hold or a newer exit clears it', () => {
    expect(bayMarkOf(DAY[1], [])).toEqual({ kind: 'bhold', at: '2026-10-29T13:40:00.000Z' });
    expect(bayMarkLine(bayMarkOf(DAY[1], [])!)).toBe('⚠️ B hold in the bay 08:40 · not flagged yet');
    expect(bayMarkLine(bayMarkOf(DAY[3], [])!)).toBe('🔧 M hold in the bay 11:05 · not flagged yet');
    expect(bayMarkOf(DAY[1], [held('v-0DM137', '2026-10-29T13:45:00.000Z')])).toBeNull();
    expect(bayMarkOf(DAY[4], [])).toBeNull();
    expect(bayMarkOf(null, [])).toBeNull();
  });
});

// ── 2026-11-04: the Erin exit, his note, "Same as the … hold" (docs/ticket-bay-erin-exit-notes-existing-hold.md).
describe('🏠 Erin on the list', () => {
  const day = [row(1, 'LZM503', '12:02', 'erin', '12:31'), row(2, 'LUR183', '13:10', 'clean', '13:40'), row(3, 'X', '14:30', 'skip', '14:48'), row(4, 'X', '15:00', 'erin', '15:20', { redo_of: 3 })];
  it('says Erin, for Erin St, and on the read-only link too', () => {
    expect(bayLines(day)[0]).toMatchObject({ kind: 'erin', label: 'Erin', note: 'for Erin St' });
    expect(bayLines(day, { readOnly: true })[0]).toMatchObject({ label: 'Erin', note: 'for Erin St' });
  });
  it('⭐ counted apart from the cleans (a clean for Erin St is not one the airport can have)', () => {
    expect(baySummary(day)).toMatchObject({ clean: 1, erin: 2 });
    expect(bayReportLine(day)).toBe('1 clean · 2 for Erin St');
  });
  it('a bumped car redone as Erin reads redone', () => {
    expect(bayLines(day)[2].note).toBe('redone 10:20');
    expect(bayLines(day)[3].note).toBe('for Erin St · was bumped');
  });
});

describe('📝 his note rides the line', () => {
  it('memo is his note, apart from the list\'s own word', () => {
    const [l] = bayLines([row(1, 'LZM503', '12:02', 'bhold', '12:31', { note: 'rear bumper scuff' })]);
    expect(l).toMatchObject({ note: 'damage', memo: 'rear bumper scuff' });
    expect(bayLines([row(1, 'A', '12:02', 'clean', '12:31')])[0].memo).toBe('');
  });
});

describe('⭐ Same as the … hold', () => {
  const h = (id: string, over: Partial<{ vehicleId: string; status: string; holdTypes: string[]; flaggedAt: string }> = {}) =>
    ({ id, vehicleId: 'v-LZM503', status: 'ACTIVE', holdTypes: ['damage'], flaggedAt: '2026-10-28T18:00:00.000Z', ...over });
  const b = row(1, 'LZM503', '12:02', 'bhold', '12:31');

  it('a row tied to a hold is flagged: no Flag it, no "not flagged yet"', () => {
    expect(isUnflaggedHold(b, [])).toBe(true);
    expect(isUnflaggedHold({ ...b, hold_id: 'h1' }, [])).toBe(false);
    expect(bayMarkOf({ ...b, hold_id: 'h1' }, [])).toBeNull();
  });
  it('offers only this car\'s ACTIVE holds of the matching kind, newest first', () => {
    const holds = [
      h('old', { flaggedAt: '2026-10-20T18:00:00.000Z' }), h('new'), h('hail', { holdTypes: ['hail'], flaggedAt: '2026-10-25T18:00:00.000Z' }),
      h('other-car', { vehicleId: 'v-X' }), h('released', { status: 'RELEASED' }), h('mech', { holdTypes: ['mechanical'] }),
    ];
    expect(sameHoldChoices(b, holds).map(x => x.id)).toEqual(['new', 'hail', 'old']);
    expect(sameHoldChoices({ ...b, exit: 'mhold' }, holds).map(x => x.id)).toEqual(['mech']);
    expect(sameHoldChoices({ ...b, exit: 'clean' }, holds)).toEqual([]);
  });
  it('names the hold by the day it was flagged', () => {
    expect(sameHoldLabel('2026-10-28T18:00:00.000Z')).toBe('Same as the Oct 28 hold');
  });
});
