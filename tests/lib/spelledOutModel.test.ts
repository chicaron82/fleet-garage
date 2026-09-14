import { describe, it, expect } from 'vitest';
import { resolveSpelledOutModel } from '../../src/lib/spelledOutModel';

// A model name read off a labelled key tag (no model code) — what FG stores for it.

const car = (id: string, make: string | null, model: string | null) => ({ id, make, model });

describe('resolveSpelledOutModel', () => {
  it('⭐ adopts the spelling the fleet already holds — a tag prints uppercase', () => {
    const fleet = [car('a', 'Hyundai', 'Tucson'), car('b', 'Hyundai', 'Tucson')];
    expect(resolveSpelledOutModel('TUCSON', fleet, 'me')).toEqual({ model: 'Tucson', make: 'Hyundai' });
  });

  it('matches across spacing as well as case', () => {
    const fleet = [car('a', 'Tesla', 'Model Y')];
    expect(resolveSpelledOutModel('MODEL  Y', fleet, 'me')).toEqual({ model: 'Model Y', make: 'Tesla' });
  });

  it('knows a model from the codex when no car carries it', () => {
    expect(resolveSpelledOutModel('CAMRY SE', [], 'me')).toEqual({ model: 'Camry SE', make: 'Toyota' });
  });

  it('keeps what he typed when nothing anywhere knows the model — and offers no make', () => {
    expect(resolveSpelledOutModel('COMPASS', [], 'me')).toEqual({ model: 'COMPASS', make: null });
  });

  it('⚠️ refuses to guess a make when the evidence names two', () => {
    const fleet = [car('a', 'Hyundai', 'Tucson'), car('b', 'Kia', 'Tucson')];
    expect(resolveSpelledOutModel('Tucson', fleet, 'me')?.make).toBeNull();
  });

  it('⚠️ the car being audited cannot vouch for itself', () => {
    const fleet = [car('me', 'Jeep', 'COMPASS')];
    expect(resolveSpelledOutModel('Compass', fleet, 'me')).toEqual({ model: 'Compass', make: null });
  });

  it('prefers the commonest spelling when the fleet disagrees', () => {
    const fleet = [car('a', 'Kia', 'Seltos'), car('b', 'Kia', 'Seltos'), car('c', 'Kia', 'SELTOS')];
    expect(resolveSpelledOutModel('seltos', fleet, 'me')?.model).toBe('Seltos');
  });

  it('ignores cars with no make when counting makes, but still learns their spelling', () => {
    const fleet = [car('a', null, 'Tucson'), car('b', 'Hyundai', 'Tucson')];
    expect(resolveSpelledOutModel('TUCSON', fleet, 'me')).toEqual({ model: 'Tucson', make: 'Hyundai' });
  });

  it('returns null for a blank read — a blank is not a claim', () => {
    expect(resolveSpelledOutModel('   ', [car('a', 'Hyundai', 'Tucson')], 'me')).toBeNull();
  });
});
