// The Erin St LOT — which class belongs in which band of rows, and how he writes a row on the sheet.
// Split out of `closingInventory.test` on 2026-09-03 alongside the module itself.
//
// Every rule below came out of Aaron correcting a mock, six rounds of it. None of them are readable
// off the form, and one of them is a mistake somebody already made in pencil on the real lot map.
import { describe, it, expect } from 'vitest';
import { suggestRow, suggestBand, rowLabel } from '../../src/lib/closingInventoryLot';

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

  // ⭐ UPDATED 2026-09-04: the Teslas came OFF this list — *"sedans are common, so teslas go with
  // sedans."* What is left is unbanded for two different reasons, and neither is an oversight:
  //   • the VOLVOS are not staged at all — *"generally wanted right away so really no point in
  //     parking them only to get buried"* (a lane is a queue, so depth is delay);
  //   • `E1` and `V` have simply never been asked about.
  it('says nothing for the classes that are not staged, or not yet asked', () => {
    for (const c of ['W4', 'Z4', 'H4', 'E1', 'V']) {
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

// ── the classes the CLASS cannot band ─────────────────────────────────────────────────────────
//
// ⭐⭐⭐ Aaron, 2026-09-04: *"E6 sedans with sedans. again goes with the look like model. because E6
// sportage and rav4's don't look like sedans so go with the SUV lanes."* — the same looks-like rule
// as the rest of the lot, applied one level down when the class is not a body type.
describe('suggestBand — the model resolves a class that is not a body type', () => {
  it('⭐ puts the E6 sedans with the sedans', () => {
    for (const m of ['Corolla', 'Camry', 'Camry SE', 'Civic']) {
      expect(suggestBand('E6', m)).toEqual(['4', '5']);
    }
  });

  it('⭐ puts the E6 SUVs with the SUVs — the two he named', () => {
    for (const m of ['Sportage', 'RAV4']) {
      expect(suggestBand('E6', m)).toEqual(['2', '3']);
    }
  });

  it('is case- and space-insensitive about the model', () => {
    expect(suggestBand('E6', '  rav4 ')).toEqual(['2', '3']);
  });

  // ⭐⭐ THE PRIUS WAS THE ONE GENUINELY AMBIGUOUS CAR — a liftback, so it fails the trunk-vs-gate
  // test, but plainly not a Sportage. It shipped returning null for a day while the question went to
  // him rather than being guessed to finish the set. *"good on you to ask about the prius. into 4-5"*
  it('⭐ puts a Prius with the sedans — his call, not my inference', () => {
    expect(suggestBand('E6', 'Prius')).toEqual(['4', '5']);
    expect(suggestRow('E6', {}, 'Prius')).toBe('4');
  });

  it('says nothing for an E6 whose model FG does not know', () => {
    expect(suggestBand('E6')).toBeNull();
    expect(suggestBand('E6', 'Kona')).toBeNull();
  });

  // ⚠️⚠️ WHOLE-STRING, NEVER A PREFIX — the B/B5 lesson one level down. A Corolla HATCHBACK is a
  // different shape and lives in class B; a prefix match on COROLLA would swallow it.
  it('does NOT match a model by its prefix', () => {
    expect(suggestBand('E6', 'Corolla Hatchback')).toBeNull();
    expect(suggestBand('E6', 'RAV4 Prime')).toBeNull();
  });

  // ⚠️ Class first, shape only as the fallback — a banded class can never be overridden by a model.
  it('never lets the model override a class that IS banded', () => {
    expect(suggestBand('B5', 'Corolla')).toEqual(['2', '3']);
    expect(suggestBand('R', 'Camry')).toEqual(['1']);
  });
});

// ⭐ *"sedans are common, so teslas go with sedans."* B9/E7/E8/E9, 25 cars, verified against FG.
describe('suggestBand — Teslas', () => {
  it('puts every Tesla class in the sedan rows', () => {
    for (const c of ['B9', 'E7', 'E8', 'E9']) expect(suggestRow(c)).toBe('4');
  });

  // ⚠️ The Volvos are still deliberately unbanded — they are not staged at all.
  it('still says nothing for the Volvos', () => {
    for (const c of ['W4', 'Z4', 'H4']) expect(suggestBand(c)).toBeNull();
  });
});
