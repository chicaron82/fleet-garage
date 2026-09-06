import { describe, it, expect } from 'vitest';

// The stage ladder is the honest half of the wait UI: it reports DURATION, never progress.
// Mirrored here rather than exported, because the component owns its copy — this test exists to
// pin the BEHAVIOUR (monotonic, no gaps, honest at the long end), not to share a constant.
const STAGES = [
  { after: 0,  text: 'Reading the schedule…' },
  { after: 10, text: 'Still reading — a full sheet takes a moment.' },
  { after: 25, text: 'Taking longer than usual. It may be on a second read.' },
  { after: 60, text: 'Still going. It has not given up, and neither has it failed.' },
];
const stageAt = (secs: number) => [...STAGES].reverse().find(s => secs >= s.after) ?? STAGES[0];

describe('the import wait ladder', () => {
  it('never leaves a second uncovered', () => {
    for (let s = 0; s <= 120; s++) expect(stageAt(s)).toBeDefined();
  });

  it('advances at his walk-away point — 10s is when he leaves for another tab', () => {
    expect(stageAt(9).text).toBe(STAGES[0].text);
    expect(stageAt(10).text).toBe(STAGES[1].text);
  });

  it('names the second read once the backup model is plausible', () => {
    expect(stageAt(25).text).toMatch(/second read/);
  });

  it('never claims a percentage or an ETA — duration is real, progress is not', () => {
    for (const s of STAGES) {
      expect(s.text).not.toMatch(/%|\bETA\b|almost|nearly|\bsoon\b/i);
    }
  });

  it('is monotonic — the message can only move forward as time passes', () => {
    let last = -1;
    for (let s = 0; s <= 180; s++) {
      const i = STAGES.indexOf(stageAt(s));
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
  });

  it('still says something honest past a minute rather than going quiet', () => {
    expect(stageAt(300).text).toMatch(/not given up/);
  });
});
