// The words today's crew is said in (src/lib/lotCrew.ts). Numbers only; "out" never with a reason. Since 2026-10-24
// the crew line is the schedule: "2 on · 1 out".
import { describe, it, expect } from 'vitest';
import { crewLine, splitFinished } from '../../src/lib/lotCrew';

describe('crewLine', () => {
  it('who is on, from the schedule', () => {
    expect(crewLine({ on: 2, out: 0 })).toBe('2 on');
  });
  it('an out is said, never as part of who is on', () => {
    expect(crewLine({ on: 2, out: 1 })).toBe('2 on · 1 out');
    expect(crewLine({ on: 0, out: 1 })).toBe('0 on · 1 out');
  });
  it('nobody on', () => {
    expect(crewLine({ on: 0, out: 0 })).toBe('None on right now');
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
