import { describe, it, expect } from 'vitest';
import { bayLines, baySummary, inTheBay, startBlock, type BayLogRow } from '../../src/lib/lotBayLog';

// Times are UTC; clockOf prints Winnipeg (CDT, UTC−5 on 2026-10-29).
const row = (id: number, plate: string, start: string, exit: BayLogRow['exit'], exitAt: string | null, extra: Partial<BayLogRow> = {}): BayLogRow => ({
  id, vehicle_id: `v-${plate}`, plate, unit_number: null, car: 'Kia Seltos · Gray', odometer: 1, took_dirty: false, redo_of: null,
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
    expect(baySummary(DAY)).toEqual({ clean: 2, mhold: 1, bhold: 1, stillToDo: 0 });
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
