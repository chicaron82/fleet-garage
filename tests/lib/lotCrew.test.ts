// The words today's crew is said in (src/lib/lotCrew.ts). Numbers only; "out" never with a reason.
import { describe, it, expect } from 'vitest';
import { driverLine, splitFinished, vsaLine } from '../../src/lib/lotCrew';

describe('vsaLine', () => {
  it('his example: one cleaning, one moving cars', () => {
    expect(vsaLine({ cleaning: 1, moving: 1, out: 0 })).toBe('Cleaning 1 of 2 · 1 moving cars');
  });
  it('an out is counted, but never as part of who is working', () => {
    expect(vsaLine({ cleaning: 2, moving: 0, out: 1 })).toBe('Cleaning 2 of 2 · 1 out');
  });
  it('nobody on', () => {
    expect(vsaLine({ cleaning: 0, moving: 0, out: 0 })).toBe('No VSAs on right now');
  });
});

describe('driverLine', () => {
  it('his drivers today: one to the airport, two on the auction run', () => {
    expect(driverLine({ airport: 1, other: 2, out: 0 })).toBe('To the airport 1 of 3 · 2 on another job');
  });
  it('nobody on', () => {
    expect(driverLine({ airport: 0, other: 0, out: 0 })).toBe('No drivers on right now');
  });
});

// Aaron, 2026-10-15: *"i'm thinking of removing those who's shift window has passed"* — folded, never lost.
describe('splitFinished', () => {
  const p = (id: string, phase: 'later' | 'on' | 'done', onNow: boolean) => ({ id, phase, onNow });
  it('finished and not counted fold away; on, later, and anyone still counted stay', () => {
    const { current, finished } = splitFinished([p('on', 'on', true), p('later', 'later', false), p('done', 'done', false), p('stayed', 'on', true)]);
    expect(current.map(x => x.id)).toEqual(['on', 'later', 'stayed']);
    expect(finished.map(x => x.id)).toEqual(['done']);
  });
});

describe('"not marked yet" (2026-10-18: the crew line waits for present)', () => {
  it('counted in the "of", said plainly, never read as nobody working', () => {
    expect(vsaLine({ cleaning: 0, moving: 0, out: 0, unmarked: 3 })).toBe('Cleaning 0 of 3 · 3 not marked yet');
    expect(driverLine({ airport: 2, other: 1, out: 0, unmarked: 1 })).toBe('To the airport 2 of 4 · 1 on another job · 1 not marked yet');
  });
  it('an older server with no count reads the way it always did', () => {
    expect(vsaLine({ cleaning: 1, moving: 1, out: 0 })).toBe('Cleaning 1 of 2 · 1 moving cars');
  });
});
