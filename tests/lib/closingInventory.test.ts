import { describe, it, expect } from 'vitest';
import {
  sheetNote, deriveStatus, entryFromScan, entryFromTag, formatUnitNumber,
  isNotWrittenUp, exclusionReason, rowTally, summarise, handEntry,
  ROW_CAPACITY, fleetRecordFor, type InventoryEntry, type ActiveHold,
} from '../../src/lib/closingInventory';

// Hertz form 8073-16, the closing write-up. Aaron, 2026-09-02: *"closing inventory. scan the tag.
// mark it's status. A available, D dirty, B body, M mechanical, F foreign."*
//
// Every rule below came out of him correcting a mock, six rounds of it. None of them are readable
// off the form.

const car = (over: Partial<Parameters<typeof entryFromScan>[0]> = {}) => ({
  id: 'v1', licensePlate: 'LUR324', unitNumber: '5422241',
  owningArea: '8199', rentalClass: 'B5', isUs: false, ...over,
});
const none: ActiveHold[] = [];

// ── the Notes column is status-dependent ──────────────────────────────────────────────────────
describe('sheetNote', () => {
  // ⭐ "available, where is it? row 1" — for an A car the note IS the location.
  it('writes the row for an available car', () => {
    expect(sheetNote({ status: 'A', row: '5', note: '' })).toBe('R-5');
  });

  it('joins the row and a note when he adds one', () => {
    expect(sheetNote({ status: 'A', row: '5', note: 'blocked in' })).toBe('R-5 · blocked in');
  });

  // ⚠️ A row on a DIRTY or HELD car would be a lie — those notes are a reason, not a place.
  it('never writes a row for a car that is not available', () => {
    for (const s of ['D', 'B', 'M', 'F'] as const) {
      expect(sheetNote({ status: s, row: '5', note: 'chip on the door' })).toBe('chip on the door');
    }
  });

  it('is empty when there is nothing to say', () => {
    expect(sheetNote({ status: 'D', row: '', note: '   ' })).toBe('');
  });
});

// ── the status carries ────────────────────────────────────────────────────────────────────────
describe('deriveStatus', () => {
  // ⭐⭐ "no default. just carry the status until changed. we'll generally write all available
  // together, dirty together etc." — and the reason is physical: the keys are sorted into piles,
  // and two people split clean from dirty when there is a lot.
  it('carries the last status forward', () => {
    expect(deriveStatus({ isUs: false }, none, 'D')).toMatchObject({ status: 'D', why: 'carried' });
  });

  // ⚠️ The first car of a session has nothing to carry, so nothing is pre-picked. A fixed default
  // of A would have been right about the common case for the WRONG REASON — and wrong the moment
  // he picks up the dirty pile.
  it('picks nothing at all on the first car', () => {
    expect(deriveStatus({ isUs: false }, none, null)).toEqual({ status: null, note: '', why: null });
  });

  it('a damage or hail hold is a B, and brings the hold\'s own words', () => {
    const holds: ActiveHold[] = [{ holdType: 'damage', damageDescription: 'Wheel — passenger rear' }];
    expect(deriveStatus({ isUs: false }, holds, 'A')).toEqual({
      status: 'B', note: 'Wheel — passenger rear', why: 'on a damage hold',
    });
    expect(deriveStatus({ isUs: false }, [{ holdType: 'hail' }], 'A').status).toBe('B');
  });

  it('a mechanical hold is an M', () => {
    expect(deriveStatus({ isUs: false }, [{ holdType: 'mechanical', damageDescription: 'PM due' }], 'A'))
      .toMatchObject({ status: 'M', note: 'PM due' });
  });

  // ⚠️⚠️ F IS THE PLATE, NOT THE OWNING BRANCH. Aaron: "foreign are vehicles with US plates on."
  // His own Sept 1 sheet is the proof: 840PIQ is owned by 8190 (Saskatchewan) and its status is
  // BLANK, while SSDY46, the US-plated Tucson, is the one marked F. Foreign owning and foreign
  // plate correlate and are not the same thing.
  it('a US plate is an F', () => {
    expect(deriveStatus({ isUs: true }, none, 'A')).toMatchObject({ status: 'F', why: 'US plate' });
  });

  it('a foreign OWNING is not an F — that is the car that separates the two', () => {
    // 840PIQ: owned by 8190, Manitoba-plated, blank on his sheet. It just carries.
    expect(deriveStatus({ isUs: false }, none, 'A').status).toBe('A');
  });

  // A hold outranks the pile he is holding — a damaged car is a B whatever he was writing.
  it('a hold overrides the carry', () => {
    expect(deriveStatus({ isUs: false }, [{ holdType: 'damage' }], 'A').status).toBe('B');
  });

  it('damage outranks mechanical when a car carries both', () => {
    const both: ActiveHold[] = [{ holdType: 'mechanical' }, { holdType: 'damage' }];
    expect(deriveStatus({ isUs: false }, both, null).status).toBe('B');
  });
});

// ── not written up at all ─────────────────────────────────────────────────────────────────────
describe('sale, turnback and buy-back are not written up', () => {
  // ⭐ "sale cars aren't written up in inventory. the one writing it down wasn't trained properly."
  // The FS row on his Sept 1 sheet is somebody else's mistake — and the rule was already in FG's own
  // closing checklist, step 1: "no need to write down Sale or Turnback cars."
  it('declines any car on a sale-car hold', () => {
    expect(isNotWrittenUp([{ holdType: 'sale_car' }])).toBe(true);
  });

  it('does not decline an ordinary held car', () => {
    expect(isNotWrittenUp([{ holdType: 'damage' }, { holdType: 'mechanical' }])).toBe(false);
    expect(isNotWrittenUp([])).toBe(false);
  });

  // ⭐ ONE hold type covers all three; the disposition only NAMES which. So this asks the question
  // once and cannot fall out of date when a fourth kind of departure appears.
  it('names which kind, for the skip card\'s own words', () => {
    expect(exclusionReason([{ holdType: 'sale_car', disposition: 'turnback' }])).toBe('Turnback');
    expect(exclusionReason([{ holdType: 'sale_car', disposition: 'buyback' }])).toBe('Buy-back');
    expect(exclusionReason([{ holdType: 'sale_car', disposition: 'sale' }])).toBe('Sale car');
  });

  // Every hold filed before migration 136 has a null disposition and must still read as a sale.
  it('reads a hold with no disposition as a plain sale', () => {
    expect(exclusionReason([{ holdType: 'sale_car' }])).toBe('Sale car');
    expect(exclusionReason([{ holdType: 'sale_car', disposition: 'leaseback' }])).toBe('Sale car');
  });

  it('has no reason for a car that is not excluded', () => {
    expect(exclusionReason([{ holdType: 'damage' }])).toBeNull();
  });
});

// ── the scan ──────────────────────────────────────────────────────────────────────────────────
describe('entryFromScan', () => {
  // ⭐ The whole argument for the feature: the tag prints four of the five columns.
  it('takes owning, unit, licence and class off the tag without asking', () => {
    const { entry } = entryFromScan(car(), none, { status: 'A', row: '5' });
    expect(entry).toMatchObject({
      plate: 'LUR324', unitNumber: '5422241', owningArea: '8199', rentalClass: 'B5',
    });
  });

  it('carries the row onto an available car', () => {
    const { entry } = entryFromScan(car(), none, { status: 'A', row: '5' });
    expect(entry.row).toBe('5');
  });

  // ⚠️ A dirty or held car's note is a REASON, not a place — inheriting "R-5" into it would be a
  // lie he then has to notice and delete.
  it('does NOT carry the row onto a car that is not available', () => {
    const { entry } = entryFromScan(car(), [{ holdType: 'damage' }], { status: 'A', row: '5' });
    expect(entry).toMatchObject({ status: 'B', row: '' });
  });

  it('suggests the row from the class without picking it', () => {
    const out = entryFromScan(car({ rentalClass: 'Q4' }), none, { status: null, row: '' });
    expect(out.suggestedRow).toBe('2');
    expect(out.entry.row).toBe('');
  });

  it('suggests nothing for a class with no single row', () => {
    expect(entryFromScan(car({ rentalClass: 'E6' }), none, { status: null, row: '' }).suggestedRow).toBeNull();
  });
});

// ── the running sheet ─────────────────────────────────────────────────────────────────────────
const row = (status: InventoryEntry['status'], r = '', note = ''): InventoryEntry => ({
  id: 'e', at: 1, vehicleId: 'v', plate: 'X', unitNumber: null, owningArea: null, rentalClass: null,
  status, row: r, note,
});

describe('rowTally', () => {
  // ⚠️ Aaron caught the mock's first version on his phone: it showed one row while his sheet held
  // available cars in three. "I have available cars in 3 different rows but only shows the last row
  // I used." The carried row is what the NEXT car inherits; this is where they actually are.
  it('counts the available cars in every row, not just the last one used', () => {
    const t = rowTally([row('A', '2'), row('A', '2'), row('A', '5'), row('A', '1')]);
    expect(t.map(x => [x.label, x.count])).toEqual([['R-1', 1], ['R-2', 2], ['R-5', 1]]);
  });

  it('counts against each row\'s real capacity', () => {
    expect(rowTally([row('A', '2')])[0]).toMatchObject({ capacity: 8, full: false });
    expect(rowTally([row('A', '7')])[0]).toMatchObject({ capacity: 4, full: false });
  });

  it('marks a row full at its own capacity — 8 up front, 4 in overflow', () => {
    const eight = Array.from({ length: 8 }, () => row('A', '3'));
    expect(rowTally(eight)[0].full).toBe(true);
    const four = Array.from({ length: 4 }, () => row('A', '9'));
    expect(rowTally(four)[0].full).toBe(true);
    expect(rowTally(four.slice(0, 3))[0].full).toBe(false);
  });

  it('ignores cars that are not available — only an A has a row', () => {
    expect(rowTally([row('D', '5'), row('B', '5'), row('M', '5'), row('F', '5')])).toEqual([]);
  });

  it('sorts numbered rows first and fence zones after', () => {
    const t = rowTally([row('A', 'SF'), row('A', '10'), row('A', '2')]);
    expect(t.map(x => x.label)).toEqual(['R-2', 'R-10', 'SF']);
  });

  it('has no capacity for a place the map does not number', () => {
    expect(rowTally([row('A', 'SF')])[0]).toMatchObject({ capacity: null, full: false });
  });

  it('every numbered row he named has a capacity', () => {
    for (const r of ['1', '2', '3', '4', '5', '6']) expect(ROW_CAPACITY[r]).toBe(8);
    for (const r of ['7', '8', '9', '10', '11', '12']) expect(ROW_CAPACITY[r]).toBe(4);
  });
});

describe('summarise', () => {
  it('counts the sheet by status', () => {
    expect(summarise([row('A', '1'), row('A', '1'), row('D'), row('F')]))
      .toEqual({ total: 4, byStatus: { A: 2, D: 1, B: 0, M: 0, F: 1 } });
  });
});

// ⚠️ The paper never refuses a car, so neither does this.
describe('handEntry', () => {
  it('takes a car FG has never seen', () => {
    expect(handEntry(' lur999 ', 'D')).toMatchObject({ vehicleId: null, plate: 'LUR999', status: 'D' });
  });
});

// ⭐ The tag groups the digits; a sheet that keeps the grouping can be checked against the tag.
describe('formatUnitNumber', () => {
  it('groups a seven-digit unit the way the key tag prints it', () => {
    expect(formatUnitNumber('5426952')).toBe('542 6952');
  });

  it('strips separators before grouping, so a re-read tag still formats', () => {
    expect(formatUnitNumber(' 542-6952 ')).toBe('542 6952');
  });

  it('⚠️ passes anything that is NOT seven digits through unchanged — never invents a shape', () => {
    expect(formatUnitNumber('12345')).toBe('12345');
    expect(formatUnitNumber('HRZ-9001')).toBe('HRZ-9001');
  });

  it('a car with no unit number stays empty rather than becoming a placeholder', () => {
    expect(formatUnitNumber(null)).toBe('');
    expect(formatUnitNumber(undefined)).toBe('');
    expect(formatUnitNumber('  ')).toBe('');
  });
});

// ── a car FG has never seen ───────────────────────────────────────────────────────────────────
//
// ⭐⭐ Aaron, 2026-09-03: *"a plate that FG hasn't seen, why wouldn't FG just record the tag anyway.
// then it just becomes something to fully register at another point in time."* The old surface read
// the whole tag, matched nothing, and told him to write it on the paper — discarding four columns it
// had just read.
describe('entryFromTag', () => {
  const tag = { plate: 'lur999', owningArea: '8199', unitNumber: '5422795', rentalClass: 'C' };

  it('⭐ keeps every column the tag printed, with no fleet record at all', () => {
    const { entry } = entryFromTag(tag, { status: 'A', row: '5' });
    expect(entry).toMatchObject({
      vehicleId: null, plate: 'LUR999', owningArea: '8199', unitNumber: '5422795', rentalClass: 'C',
    });
  });

  it('carries the status and, for an available car, the row', () => {
    const { entry, why } = entryFromTag(tag, { status: 'A', row: '5' });
    expect(entry.status).toBe('A');
    expect(entry.row).toBe('5');
    expect(why).toBe('carried — not in the fleet');
  });

  // ⚠️ A row on a non-available car would be a lie — same rule as entryFromScan.
  it('never inherits a row onto a car that is not available', () => {
    expect(entryFromTag(tag, { status: 'D', row: '5' }).entry.row).toBe('');
  });

  // ⚠️⚠️ NOTHING IS DEDUCED. There are no holds on a car FG has never seen, and F is about the PLATE
  // being American — which the owning area cannot tell us (840PIQ is owned by 8190 and is an A).
  it('deduces no status of its own — he decides, as he would on paper', () => {
    const { entry, why } = entryFromTag(tag, { status: null, row: '' });
    expect(entry.status).toBe('A');   // the field needs a value; `why` is what says nothing was known
    expect(why).toBe('not in the fleet');
  });

  it('still suggests a row from the class the tag printed', () => {
    expect(entryFromTag(tag, { status: 'A', row: '' }).suggestedRow).toBe('4');       // C → sedans
    expect(entryFromTag({ ...tag, rentalClass: 'Q4' }, { status: 'A', row: '' }).suggestedRow).toBe('2');
  });

  it('takes a tag that gave up only a plate', () => {
    const { entry, suggestedRow } = entryFromTag({ plate: 'LUR999' }, { status: 'D', row: '' });
    expect(entry).toMatchObject({ plate: 'LUR999', owningArea: null, unitNumber: null, rentalClass: null });
    expect(suggestedRow).toBeNull();
  });
});

describe('fleetRecordFor — the row is built from the fleet, not the scan\'s copy', () => {
  // ⚠️ Aaron's regression, caught in the lot 2026-09-05. A key-tag scan backfills the very car it
  // just resolved, so the vehicle inside the scan result is one write out of date by the time the
  // sheet row is built from it. LUR402 landed on the closing sheet with a BLANK owning area while
  // its own record already read 8199 — stamped `tag`, written by that same scan seconds earlier.
  // LUR401 beside it came out right only because its owning had been on file since Aug 20: nothing
  // to backfill, nothing to go stale. So this misses exactly the thin records a closing sweep finds.
  const scanned = car({ owningArea: null });

  it('prefers the fleet record over the stale copy the scan captured', () => {
    expect(fleetRecordFor(scanned, [car({ id: 'v0' }), car()]).owningArea).toBe('8199');
  });

  it('falls back to the scanned copy for a car the fleet list genuinely does not hold', () => {
    expect(fleetRecordFor(scanned, [car({ id: 'v0' })])).toBe(scanned);
  });

  it('matches on id, never on plate — a corrected misread must still find its record', () => {
    // `resolveKeytagScan` can correct a misread plate, so the plate in hand is not a safe key.
    expect(fleetRecordFor(scanned, [car({ licensePlate: 'LUR4O2' })]).owningArea).toBe('8199');
  });

  it('carries the backfilled owning all the way into the sheet row', () => {
    const fleet = [car()];
    const stale = entryFromScan(scanned, none, { status: 'B', row: '' });
    const live = entryFromScan(fleetRecordFor(scanned, fleet), none, { status: 'B', row: '' });
    expect(stale.entry.owningArea).toBeNull();   // what he saw on the sheet
    expect(live.entry.owningArea).toBe('8199');  // what it should have carried
  });
});

