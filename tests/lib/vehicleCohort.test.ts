import { describe, it, expect } from 'vitest';
import { cohortStep } from '../../src/lib/vehicleCohort';

describe('cohortStep', () => {
  const list = ['a', 'b', 'c'];

  it('reports position and both neighbours in the middle', () => {
    expect(cohortStep(list, 'b')).toEqual({ index: 2, total: 3, prevId: 'a', nextId: 'c' });
  });

  it('⭐ does not wrap at either end — a worklist has an end', () => {
    // Looping silently would hide the fact that he has finished the list.
    expect(cohortStep(list, 'a').prevId).toBeNull();
    expect(cohortStep(list, 'c').nextId).toBeNull();
  });

  it('goes quiet with no list at all', () => {
    expect(cohortStep(undefined, 'a').total).toBe(0);
  });

  it('goes quiet for a list of one — there is nothing to step to', () => {
    expect(cohortStep(['a'], 'a').total).toBe(0);
  });

  it('⭐ goes quiet when the car has fallen OUT of the list', () => {
    // Real case: he opens a held car from a filtered list, marks it repaired, and the filter no
    // longer matches it. "0 of 14" or a guessed neighbour would both be worse than no arrows.
    expect(cohortStep(list, 'zzz')).toEqual({ index: 0, total: 0, prevId: null, nextId: null });
  });

  it('handles the two-entry case at both ends', () => {
    expect(cohortStep(['a', 'b'], 'a')).toEqual({ index: 1, total: 2, prevId: null, nextId: 'b' });
    expect(cohortStep(['a', 'b'], 'b')).toEqual({ index: 2, total: 2, prevId: 'a', nextId: null });
  });
});
