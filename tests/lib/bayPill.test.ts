// The header bay pill's plan (docs/ticket-header-bay-pill.md): what a tap sends, and what it says.
import { describe, it, expect } from 'vitest';
import { bayPillPlan } from '../../src/lib/bayPill';

const car = { plate: 'LUR437' };

describe('bayPillPlan', () => {
  it('⭐ a tap is the Clean, and it names the car on deck coming in', () => {
    const p = bayPillPlan(car, null, 'KUR261');
    expect(p.exit).toBe('clean');
    expect([p.chip, p.done]).toEqual(['✓', '✓ KUR261 in']);
    expect(p.label).toBe('LUR437 in the bay. Tap to finish the clean, KUR261 comes in');
    expect(p.heldLabel).toBe('LUR437 clean, KUR261 comes in. Undo');
  });

  it('nothing on deck: it says only the car', () => {
    const p = bayPillPlan(car, null, null);
    expect([p.exit, p.done, p.label]).toEqual(['clean', '✓ Saved', 'LUR437 in the bay. Tap to finish the clean']);
  });

  it("the car's own plate on the slot is a stale slot, not a car waiting", () => {
    expect(bayPillPlan(car, null, 'LUR437').done).toBe('✓ Saved');
  });

  it('⭐ narrow enough for the top bar at 412: the held chip is one mark, not the two plates', () => {
    const p = bayPillPlan(car, null, 'KUR261');
    expect([p.chip.length <= 2, p.face.length <= 7]).toEqual([true, true]);
  });

  it('⭐ the face is the plate, never a time (the bay log: "Durations, NEVER")', () => {
    expect(bayPillPlan(car, null, null).face).toBe('LUR437');
    expect(bayPillPlan(car, null, null).face).not.toMatch(/\d+\s*m\b|\d:\d\d/);
  });

  it('⭐ held since it came in: the tap closes it as held, never as a Clean', () => {
    const m = bayPillPlan(car, { kind: 'mhold', at: '2026-11-15T20:00:00Z' }, 'KUR261');
    expect([m.exit, m.face, m.chip, m.done]).toEqual(['mhold', '🔧 LUR437', '🔧', '✓ KUR261 in']);
    expect(m.label).toBe('LUR437 in the bay, held. Tap to close it as M hold, KUR261 comes in');
    const b = bayPillPlan(car, { kind: 'bhold', at: '2026-11-15T20:00:00Z' }, null);
    expect([b.exit, b.face, b.heldLabel]).toEqual(['bhold', '⚠️ LUR437', 'LUR437 closing as B hold. Undo']);
  });
});
