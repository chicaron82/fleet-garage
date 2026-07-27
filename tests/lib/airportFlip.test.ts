import { describe, it, expect } from 'vitest';
import { flipRowLine, buildFlipReport, normalizeFlipRow, flipClassSummary, mergeFlipRows, sameFlipRows, type FlipRow } from '../../src/lib/airportFlip';

const row = (over: Partial<FlipRow>): FlipRow => ({
  id: 'r1', plate: 'LFJ285', unit: '5427802', odo: '41230', fuel: '7/8',
  isEv: false, damaged: false, rentalClass: '', notes: '', checked: true, sent: false, at: 0, deleted: false, ...over,
});

describe('flipRowLine', () => {
  it('plate leads (the counter searches by plate), then the filled fields', () => {
    expect(flipRowLine(row({}))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });

  it('a damaged return carries the flag — the field the counter most needs before closing', () => {
    expect(flipRowLine(row({ damaged: true }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · ⚠️ damage');
  });

  it('omits fields left blank rather than printing empty labels', () => {
    expect(flipRowLine(row({ odo: '', fuel: '' }))).toBe('LFJ285');
    expect(flipRowLine(row({ fuel: '' }))).toBe('LFJ285 · odo 41230');
  });

  it('never includes the unit# — the copy-out is minimal by design (plate only)', () => {
    expect(flipRowLine(row({ unit: '5427802' }))).not.toContain('5427802');
  });

  it('trims whitespace out of the readings', () => {
    expect(flipRowLine(row({ odo: '  41230 ', fuel: ' F ' }))).toBe('LFJ285 · odo 41230 · fuel F');
  });

  it('a note rides the line only when filled (last, after the damage flag)', () => {
    expect(flipRowLine(row({ notes: 'weed smell' }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · weed smell');
    expect(flipRowLine(row({ damaged: true, notes: 'weed smell' }))).toBe('LFJ285 · odo 41230 · fuel 7/8 · ⚠️ damage · weed smell');
    expect(flipRowLine(row({ notes: '   ' }))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });
});

describe('buildFlipReport', () => {
  it('one line per row, newline-joined', () => {
    const text = buildFlipReport([
      row({ id: 'a', plate: 'LFJ285' }),
      row({ id: 'b', plate: 'LUR170', odo: '12005', fuel: 'F', damaged: true }),
    ]);
    expect(text).toBe('LFJ285 · odo 41230 · fuel 7/8\nLUR170 · odo 12005 · fuel F · ⚠️ damage');
  });

  it('empty set → empty string (caller skips the clipboard write)', () => {
    expect(buildFlipReport([])).toBe('');
  });
});

describe('flipRowLine — resilience to rows saved before a field existed', () => {
  it('does NOT throw on a row missing notes (persisted before the notes field shipped)', () => {
    // A row hydrated from sessionStorage written by an older build has no `notes` key.
    // The list re-renders it, so flipRowLine must survive the undefined (the 2026-07-17 crash).
    const old = { id: 'r', plate: 'LFJ285', unit: null, odo: '41230', fuel: '7/8', damaged: false, checked: true, sent: false } as unknown as FlipRow;
    expect(() => flipRowLine(old)).not.toThrow();
    expect(flipRowLine(old)).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });
});

describe('normalizeFlipRow', () => {
  it('fills every missing field so an old persisted row can never crash a render', () => {
    const healed = normalizeFlipRow({ id: 'r', plate: 'LFJ285', odo: '41230', fuel: '7/8' });
    expect(healed).toEqual({ id: 'r', plate: 'LFJ285', unit: null, odo: '41230', fuel: '7/8', isEv: false, damaged: false, rentalClass: '', notes: '', checked: true, sent: false, at: 0, deleted: false });
  });
  it('preserves what is already there (a sent+unchecked row stays that way)', () => {
    const row: FlipRow = { id: 'r', plate: 'LUR170', unit: '5427802', odo: '1', fuel: 'F', isEv: false, damaged: true, rentalClass: 'Q4', notes: 'weed smell', checked: false, sent: true, at: 1700000000000, deleted: false };
    expect(normalizeFlipRow(row)).toEqual(row);
  });
});

// ── flipClassSummary: Aaron's own "what I turned around, by class" shift tally ──────────
describe('flipClassSummary', () => {
  it('counts flips by class, most-flipped first', () => {
    const rows = [
      row({ id: '1', rentalClass: 'Q4' }),
      row({ id: '2', rentalClass: 'P4' }),
      row({ id: '3', rentalClass: 'Q4' }),
      row({ id: '4', rentalClass: 'Q4' }),
      row({ id: '5', rentalClass: 'V' }),
    ];
    expect(flipClassSummary(rows)).toEqual({
      byClass: [
        { rentalClass: 'Q4', count: 3 },
        { rentalClass: 'P4', count: 1 },
        { rentalClass: 'V', count: 1 },
      ],
      unclassed: 0,
    });
  });

  it('normalizes case and whitespace so "q4" and "Q4 " count together', () => {
    const rows = [row({ id: '1', rentalClass: 'q4' }), row({ id: '2', rentalClass: 'Q4 ' })];
    expect(flipClassSummary(rows)).toEqual({ byClass: [{ rentalClass: 'Q4', count: 2 }], unclassed: 0 });
  });

  it('counts rows with no legible class as unclassed — never implies all were classed', () => {
    const rows = [row({ id: '1', rentalClass: 'Q4' }), row({ id: '2', rentalClass: '' }), row({ id: '3', rentalClass: '  ' })];
    expect(flipClassSummary(rows)).toEqual({ byClass: [{ rentalClass: 'Q4', count: 1 }], unclassed: 2 });
  });

  it('ties break alphabetically by class', () => {
    const rows = [row({ id: '1', rentalClass: 'V' }), row({ id: '2', rentalClass: 'P4' })];
    expect(flipClassSummary(rows).byClass).toEqual([{ rentalClass: 'P4', count: 1 }, { rentalClass: 'V', count: 1 }]);
  });

  it('empty list → empty tally', () => {
    expect(flipClassSummary([])).toEqual({ byClass: [], unclassed: 0 });
  });
});

describe('normalizeFlipRow heals the added rentalClass field', () => {
  it('an older stored row with no rentalClass defaults to blank, never crashes', () => {
    const old = { id: 'x', plate: 'ABC123', odo: '100', fuel: 'F', damaged: false, checked: true, sent: false };
    expect(normalizeFlipRow(old).rentalClass).toBe('');
  });
});

// An EV return captures a battery PERCENTAGE, not a fuel fraction — the counter line has to say so.
describe('flipRowLine — EV returns read "charge", gas reads "fuel"', () => {
  it('an EV row labels the level as charge', () => {
    expect(flipRowLine(row({ isEv: true, fuel: '67%' }))).toBe('LFJ285 · odo 41230 · charge 67%');
  });

  it('a gas row still labels it fuel', () => {
    expect(flipRowLine(row({ isEv: false, fuel: '7/8' }))).toBe('LFJ285 · odo 41230 · fuel 7/8');
  });

  it('an older persisted row with no isEv defaults to fuel, never crashes', () => {
    const old = { id: 'x', plate: 'ABC123', odo: '100', fuel: 'F', damaged: false, checked: true, sent: false };
    expect(normalizeFlipRow(old).isEv).toBe(false);
    expect(flipRowLine(normalizeFlipRow(old))).toBe('ABC123 · odo 100 · fuel F');
  });
});

// ── mergeFlipRows: the cross-device reconciliation ────────────────────────────────────────
//
// Found in the 2026-07-26 line-check (never hit live): the sync stored ONE payload under
// whole-list last-write-wins and pulled once per shift-day, so a device open before another
// device wrote would push its stale list and silently drop the other's flips. These cases are
// the concrete loss scenarios from that finding.
describe('mergeFlipRows', () => {
  const r = (id: string, at: number, over: Partial<FlipRow> = {}) =>
    row({ id, at, plate: id.toUpperCase(), ...over });

  it('THE BUG: keeps a flip only the other device has', () => {
    // Phone flipped A. Computer hydrated, flipped B. Phone (still alive) then flipped C.
    // Under the old whole-list LWW the phone pushed [A,C] and B vanished.
    const phone  = [r('a', 100), r('c', 300)];
    const server = [r('a', 100), r('b', 200)];
    expect(mergeFlipRows(phone, server).map(x => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('THE OTHER DIRECTION: offline rows survive a newer server write', () => {
    // Phone flipped offline (newer stamp, never pushed); computer wrote later.
    const phoneOffline = [r('a', 100), r('offline', 500)];
    const server       = [r('a', 100), r('computer', 400)];
    const out = mergeFlipRows(phoneOffline, server);
    expect(out.map(x => x.id).sort()).toEqual(['a', 'computer', 'offline']);
  });

  it('per-row newest wins on a genuine same-row conflict', () => {
    const local  = [r('a', 100, { odo: 'stale' })];
    const server = [r('a', 200, { odo: 'fresher' })];
    expect(mergeFlipRows(local, server)[0].odo).toBe('fresher');
    // ...and not the other way round
    expect(mergeFlipRows(server, local)[0].odo).toBe('fresher');
  });

  it('a tie keeps the local row — deterministic, no clock-skew tiebreaker', () => {
    const local  = [r('a', 100, { odo: 'mine' })];
    const server = [r('a', 100, { odo: 'theirs' })];
    expect(mergeFlipRows(local, server)[0].odo).toBe('mine');
  });

  it('a tombstone does NOT get resurrected by the other side of the merge', () => {
    // The reason deletes are tombstoned rather than spliced: a plain id-union would bring the
    // row back from whichever device still had it.
    const deletedHere = [r('a', 300, { deleted: true })];
    const stillThere  = [r('a', 100)];
    expect(mergeFlipRows(deletedHere, stillThere)[0].deleted).toBe(true);
    expect(mergeFlipRows(stillThere, deletedHere)[0].deleted).toBe(true);
  });

  it('a re-add after a delete wins, because it is newer', () => {
    const readded = [r('a', 400, { deleted: false })];
    const tomb    = [r('a', 300, { deleted: true })];
    expect(mergeFlipRows(readded, tomb)[0].deleted).toBe(false);
  });

  it("preserves THIS device's row order — the list must not reshuffle mid-shift", () => {
    const local  = [r('c', 300), r('a', 100), r('b', 200)];
    const server = [r('a', 100), r('b', 200), r('z', 400)];
    expect(mergeFlipRows(local, server).map(x => x.id)).toEqual(['c', 'a', 'b', 'z']);
  });

  // Idempotence + commutativity are what make the refocus re-pull safe: re-running can't drift,
  // and two devices reconciling can't ping-pong writes.
  it('is idempotent — merging twice equals merging once', () => {
    const local  = [r('a', 100), r('c', 300)];
    const server = [r('a', 100), r('b', 200)];
    const once = mergeFlipRows(local, server);
    expect(mergeFlipRows(once, server)).toEqual(once);
  });

  it('agrees on the same SET from either side', () => {
    const local  = [r('a', 100), r('c', 300)];
    const server = [r('b', 200), r('a', 150)];
    const l = mergeFlipRows(local, server).map(x => `${x.id}@${x.at}`).sort();
    const s = mergeFlipRows(server, local).map(x => `${x.id}@${x.at}`).sort();
    expect(l).toEqual(s);
  });

  it('legacy rows (at: 0, written before this field) lose to any stamped edit', () => {
    const legacy  = [r('a', 0,   { odo: 'legacy' })];
    const stamped = [r('a', 1,   { odo: 'stamped' })];
    expect(mergeFlipRows(legacy, stamped)[0].odo).toBe('stamped');
  });

  it('empty sides are no-ops in both directions', () => {
    const rows = [r('a', 100)];
    expect(mergeFlipRows(rows, [])).toEqual(rows);
    expect(mergeFlipRows([], rows)).toEqual(rows);
  });
});

describe('sameFlipRows', () => {
  it('true only when the same rows sit at the same versions', () => {
    expect(sameFlipRows([row({ id: 'a', at: 1 })], [row({ id: 'a', at: 1 })])).toBe(true);
    expect(sameFlipRows([row({ id: 'a', at: 1 })], [row({ id: 'a', at: 2 })])).toBe(false);
    expect(sameFlipRows([row({ id: 'a', at: 1 })], [row({ id: 'b', at: 1 })])).toBe(false);
    expect(sameFlipRows([], [row({ id: 'a', at: 1 })])).toBe(false);
  });
});
