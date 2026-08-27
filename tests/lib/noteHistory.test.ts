import { describe, it, expect } from 'vitest';
import { noteEpisodes, pastNoteEpisodes } from '../../src/lib/noteHistory';
import type { VehicleChangeRow } from '../../src/lib/vehicleChanges';

const row = (changedAt: string, from: string | null, to: string | null): VehicleChangeRow =>
  ({ changedAt, op: 'UPDATE', changed: { note: { from, to } } });

const other = (changedAt: string): VehicleChangeRow =>
  ({ changedAt, op: 'UPDATE', changed: { odometer: { from: null, to: 4865 } } });

// LZM533's real rows, newest-first exactly as useVehicleChanges returns them.
const LZM533: VehicleChangeRow[] = [
  row('2026-08-27T00:01:25Z', 'Assigned to car star Fife', null),
  other('2026-08-26T17:39:13Z'),
  row('2026-08-21T18:56:41Z', null, 'Assigned to car star Fife'),
];

describe('noteEpisodes', () => {
  it('pairs a set and a clear into one episode — the real LZM533 case', () => {
    expect(noteEpisodes(LZM533)).toEqual([
      { text: 'Assigned to car star Fife', setAt: '2026-08-21T18:56:41Z', clearedAt: '2026-08-27T00:01:25Z' },
    ]);
  });

  it('ignores changes to other fields', () => {
    expect(noteEpisodes([other('2026-08-26T17:39:13Z')])).toEqual([]);
  });

  // ⚠️ The caller returns newest-first; pairing depends on chronology. A summary that depends on the
  // query's ORDER BY breaks the day someone changes the query.
  it('gives the same answer whatever order the rows arrive in', () => {
    expect(noteEpisodes([...LZM533].reverse())).toEqual(noteEpisodes(LZM533));
  });

  it('leaves a still-current note open', () => {
    const rows = [row('2026-08-21T18:56:41Z', null, 'At Speedy')];
    expect(noteEpisodes(rows)).toEqual([{ text: 'At Speedy', setAt: '2026-08-21T18:56:41Z', clearedAt: null }]);
  });

  // ⚠️ An EDIT is a clear and a set at one instant. Treating it as only a start loses the old note;
  // as only an end, loses the new one.
  it('treats an edit as one episode ending and another beginning', () => {
    const rows = [
      row('2026-08-24T10:00:00Z', 'At Carstar', 'At Speedy'),
      row('2026-08-21T09:00:00Z', null, 'At Carstar'),
    ];
    expect(noteEpisodes(rows)).toEqual([
      { text: 'At Speedy',  setAt: '2026-08-24T10:00:00Z', clearedAt: null },
      { text: 'At Carstar', setAt: '2026-08-21T09:00:00Z', clearedAt: '2026-08-24T10:00:00Z' },
    ]);
  });

  it('handles several separate episodes on one car, newest first', () => {
    const rows = [
      row('2026-08-20T00:00:00Z', 'Second', null),
      row('2026-08-18T00:00:00Z', null, 'Second'),
      row('2026-08-10T00:00:00Z', 'First', null),
      row('2026-08-01T00:00:00Z', null, 'First'),
    ];
    expect(noteEpisodes(rows).map(e => e.text)).toEqual(['Second', 'First']);
  });

  // ⚠️ The log is capped at 50 rows. A clear whose matching set fell outside the window must still
  // appear — "cleared on this date, start unknown" beats dropping it or inventing a date.
  it('keeps a clear whose start is outside the change window', () => {
    const rows = [row('2026-08-26T00:00:00Z', 'Old note nobody saw start', null)];
    expect(noteEpisodes(rows)).toEqual([
      { text: 'Old note nobody saw start', setAt: null, clearedAt: '2026-08-26T00:00:00Z' },
    ]);
  });

  it('ignores a whitespace-only note on both sides', () => {
    expect(noteEpisodes([row('2026-08-26T00:00:00Z', '   ', null)])).toEqual([]);
  });

  it('survives a malformed or absent note change', () => {
    const junk = [
      { changedAt: '2026-08-26T00:00:00Z', op: 'UPDATE', changed: {} },
      { changedAt: '2026-08-25T00:00:00Z', op: 'UPDATE', changed: { note: 'not an object' } },
    ] as unknown as VehicleChangeRow[];
    expect(noteEpisodes(junk)).toEqual([]);
  });
});

describe('pastNoteEpisodes', () => {
  // ⭐ The current note is excluded on purpose — VehicleNote already renders it with its own date,
  // and repeating it under "past notes" would make a live note look finished.
  it('returns only notes that are over', () => {
    const rows = [
      row('2026-08-24T10:00:00Z', null, 'Current one'),
      row('2026-08-20T00:00:00Z', 'Finished one', null),
      row('2026-08-18T00:00:00Z', null, 'Finished one'),
    ];
    expect(pastNoteEpisodes(rows).map(e => e.text)).toEqual(['Finished one']);
  });

  it('is empty for a car that has only ever had its current note', () => {
    expect(pastNoteEpisodes([row('2026-08-21T18:56:41Z', null, 'At Speedy')])).toEqual([]);
  });

  it('finds LZM533 exactly one past note', () => {
    expect(pastNoteEpisodes(LZM533)).toHaveLength(1);
  });
});
