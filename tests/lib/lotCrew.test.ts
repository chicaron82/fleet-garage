// The words today's crew is said in (src/lib/lotCrew.ts). Numbers only; "out" never with a reason.
import { describe, it, expect } from 'vitest';
import { driverLine, vsaLine } from '../../src/lib/lotCrew';

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
