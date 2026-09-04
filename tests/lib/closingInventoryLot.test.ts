// The Erin St LOT — which class belongs in which band of rows, and how he writes a row on the sheet.
// Split out of `closingInventory.test` on 2026-09-03 alongside the module itself.
//
// Every rule below came out of Aaron correcting a mock, six rounds of it. None of them are readable
// off the form, and one of them is a mistake somebody already made in pencil on the real lot map.
import { describe, it, expect } from 'vitest';
import { suggestRow, rowLabel } from '../../src/lib/closingInventoryLot';

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
