import { describe, it, expect } from 'vitest';
import {
  suggestRow, rowLabel, sheetNote, deriveStatus, entryFromScan, formatUnitNumber,
  isNotWrittenUp, exclusionReason, rowTally, summarise, handEntry,
  ROW_CAPACITY, type InventoryEntry, type ActiveHold,
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

// ── the class → row band ──────────────────────────────────────────────────────────────────────
//
// ⭐⭐ Aaron's simple version, and it is the real rule because it is about the CAR, not the code:
// *"1 - large vehicles/premiums · 2 and 3, SUV style · 4 and 5 sedans and small vehicles · 6 erin
// st reservations."* The class lists are only how FG recognises which band a car is in.
describe('suggestRow', () => {
  it('puts the large and premium classes in row 1', () => {
    // Minivans, F-150s, the whole T family, and O6 — "naturally an O6 midsize truck is parked
    // where the other trucks are parked. row 1".
    for (const c of ['R', 'S', 'T', 'T4', 'T6', 'O6']) expect(suggestRow(c)).toBe('1');
  });

  it('puts the SUVs in row 2, the first of their band', () => {
    for (const c of ['B4', 'B5', 'Q4', 'L', 'L2']) expect(suggestRow(c)).toBe('2');
  });

  // ⭐ "B, C, F, sedans. compact, mid-size, full size." And "small vehicles" is what resolves B:
  // its Kona, Versa and Corolla Hatchback are three body types that are all SMALL. The ambiguity I
  // had flagged in that class was mine, not the lot's.
  it('puts the sedans and small cars in row 4', () => {
    for (const c of ['B', 'C', 'F']) expect(suggestRow(c)).toBe('4');
  });

  // ⭐ A BAND IS SEVERAL ROWS, and which one a car sits in is a FILL question rather than a class
  // one — R2 and R3 hold the same thing, so the second only opens when the first is full.
  it('rolls to the second row of a band once the first is full', () => {
    expect(suggestRow('Q4', { '2': 8 })).toBe('3');
    expect(suggestRow('Q4', { '2': 7 })).toBe('2');
    expect(suggestRow('C', { '4': 8 })).toBe('5');
  });

  it('still names the band when every row in it is full', () => {
    expect(suggestRow('Q4', { '2': 8, '3': 8 })).toBe('3');
  });

  // ⚠️⚠️ E6 IS THE HYBRID CLASS, NOT A BODY TYPE — 43 cars: Civic, Camry, Corolla, Prius, AND
  // Sportage and RAV4. A hybrid Camry is a sedan and a hybrid RAV4 is an SUV, so it has no single
  // row and never will. Silence here is correct rather than timid.
  it('says nothing for E6, because a rental class is not necessarily a body type', () => {
    expect(suggestRow('E6')).toBeNull();
  });

  it('says nothing for the classes nobody has banded yet', () => {
    // "Premiums" sits in row 1's description and a subcompact XC40 is not obviously a row-1 car,
    // so the Volvos, the Teslas, E1 and V wait for an answer instead of getting an inference.
    for (const c of ['W4', 'Z4', 'H4', 'E7', 'E8', 'B9', 'E9', 'E1', 'V']) {
      expect(suggestRow(c)).toBeNull();
    }
  });

  // ⚠️⚠️ THE ONE THAT MATTERS, and it got SHARPER once the bands were complete. Aaron on his own
  // lot map: "B5 is a crossover. someone lumped it in with B because it shares a letter." A person
  // made that mistake in pencil years ago, and a `startsWith` would reproduce it in TypeScript.
  //
  // ⭐ Now B is banded too — and it lands in a DIFFERENT BAND from B5. So a prefix match would not
  // merely be sloppy, it would park a sedan in the SUV rows.
  it('puts B and B5 in different bands — a prefix match would cross them', () => {
    expect(suggestRow('B')).toBe('4');    // sedans / small
    expect(suggestRow('B5')).toBe('2');   // SUV style
  });

  it('does NOT match a class by its first letter', () => {
    expect(suggestRow('Q')).toBeNull();   // Q4 is banded; bare Q is not a class
    expect(suggestRow('S5')).toBeNull();  // shares a letter with S, which IS row 1
    expect(suggestRow('T5')).toBeNull();  // T, T4 and T6 are all row 1; T5 is not a class
  });

  // ⭐ And the counter-case proves the rule rather than weakening it: L2 IS an L-band SUV, so a
  // prefix match would have got this one right BY LUCK. It is listed by name because it was ASKED.
  it('includes L2 because it was asked about, not because it starts with L', () => {
    expect(suggestRow('L2')).toBe('2');
  });

  it('says nothing for a class that is not a rental class at all', () => {
    expect(suggestRow('CKNE')).toBeNull();   // a MODEL code, not a rental class
    expect(suggestRow('ZZZ')).toBeNull();
  });

  it('is case- and space-insensitive about the class itself', () => {
    expect(suggestRow(' b5 ')).toBe('2');
    expect(suggestRow(null)).toBeNull();
    expect(suggestRow('')).toBeNull();
  });
});

// ── how he writes a row ───────────────────────────────────────────────────────────────────────
describe('rowLabel', () => {
  it('writes a numbered row the way he does on the sheet', () => {
    expect(rowLabel('5')).toBe('R-5');
    expect(rowLabel('12')).toBe('R-12');
  });

  // The lot map carries more than numbers: fence zones (BR-2A, FF-1B), the south fence where the
  // dirties live (SF), and numbered overflow stalls (8-3). Those are places, not rows.
  it('passes a fence zone or a stall through untouched', () => {
    expect(rowLabel('SF')).toBe('SF');
    expect(rowLabel('br-2a')).toBe('BR-2A');
    expect(rowLabel('8-3')).toBe('8-3');
  });

  it('is empty for nothing', () => {
    expect(rowLabel('')).toBe('');
    expect(rowLabel(null)).toBe('');
  });
});

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
  vehicleId: 'v', plate: 'X', unitNumber: null, owningArea: null, rentalClass: null,
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
