import { describe, it, expect } from 'vitest';
import { fleetMakeup, NO_NAME } from '../../src/lib/fleetMakeup';

// ⭐⭐ Aaron, 2026-09-19: *"how much of each model we have for the makes we have in the fleet"*.
// The design decision under test is the CLASS column — model alone is a census, model WITH its class
// is what he reasons with, because several models straddle classes (Kicks B4/B5 after the model-year
// move, Sportage E6/Q4 for the hybrids, Model 3 across four).
// See docs/September/ticket-what-the-fleet-is-made-of.md.

const car = (make: string, model: string, rentalClass: string | null = 'B5') => ({ make, model, rentalClass });

describe('fleetMakeup', () => {
  it('groups models under their make and counts both levels', () => {
    const out = fleetMakeup([
      car('Kia', 'Seltos'), car('Kia', 'Seltos'), car('Kia', 'Carnival', 'R'),
      car('Nissan', 'Kicks', 'B4'),
    ]);
    expect(out.map(m => [m.make, m.count])).toEqual([['Kia', 3], ['Nissan', 1]]);
    expect(out[0].models).toEqual([
      { model: 'Seltos', count: 2, classes: ['B5'] },
      { model: 'Carnival', count: 1, classes: ['R'] },
    ]);
  });

  // ⭐ THE REASON THE CARD EXISTS. A straddling model is information, not noise: the Kicks is B4 and
  // B5 because the class moved with the 2026 model year (reference_rental_class_by_model_year).
  it('⭐ keeps EVERY class a model rents as, sorted', () => {
    const out = fleetMakeup([
      car('Nissan', 'Kicks', 'B5'), car('Nissan', 'Kicks', 'B4'), car('Nissan', 'Kicks', 'B4'),
    ]);
    expect(out[0].models[0]).toEqual({ model: 'Kicks', count: 3, classes: ['B4', 'B5'] });
  });

  it('commonest first at both levels, ties alphabetical — a glance lands in the same place', () => {
    const out = fleetMakeup([
      car('Ford', 'Escape'), car('Ford', 'Escape'),
      car('Kia', 'Seltos'), car('Kia', 'Seltos'),
      car('Kia', 'Soul'), car('Kia', 'Rio'),
      car('Toyota', 'Corolla'),
    ]);
    expect(out.map(m => m.make)).toEqual(['Kia', 'Ford', 'Toyota']);   // 4, 2, 1
    expect(out[0].models.map(m => m.model)).toEqual(['Seltos', 'Rio', 'Soul']); // 2, then a–z
  });

  // ⚠️ A car with no class still EXISTS. Counting it but showing no chip keeps the total honest —
  // dropping the row would make the make's count disagree with the class bars beside it.
  it('⚠️ a car with no rental class is counted and contributes no chip', () => {
    const out = fleetMakeup([car('Mazda', 'CX-5', null), car('Mazda', 'CX-5', 'Q4')]);
    expect(out[0].models[0]).toEqual({ model: 'CX-5', count: 2, classes: ['Q4'] });
  });

  // ⚠️ Same reasoning one level up: an unnamed car is a gap to SEE, not a row to hide. FG exists to
  // remove ambiguity, and a car silently missing from a census is ambiguity with a tidy total.
  it('⚠️ a missing make or model shows as — rather than vanishing', () => {
    const out = fleetMakeup([{ make: null, model: '  ', rentalClass: 'B5' }]);
    expect(out).toEqual([{ make: NO_NAME, count: 1, models: [{ model: NO_NAME, count: 1, classes: ['B5'] }] }]);
  });

  it('trims and does not split one model across whitespace', () => {
    const out = fleetMakeup([car('Kia', 'Seltos '), car('Kia', ' Seltos')]);
    expect(out[0].models).toEqual([{ model: 'Seltos', count: 2, classes: ['B5'] }]);
  });

  it('an empty fleet is an empty list, not a row of zeroes', () => {
    expect(fleetMakeup([])).toEqual([]);
  });

  // The make total is the sum of its models — the card prints both, and they must agree.
  it('a make total always equals its models', () => {
    const out = fleetMakeup([
      car('Toyota', 'Corolla', 'C'), car('Toyota', 'Corolla', 'E6'), car('Toyota', 'RAV4', 'Q4'),
    ]);
    expect(out[0].count).toBe(out[0].models.reduce((t, m) => t + m.count, 0));
  });
});
