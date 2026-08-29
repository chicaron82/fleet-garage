import { describe, it, expect } from 'vitest';
import { owningPresets, type OwningPresetVehicle } from '../../src/lib/owningPresets';

// ⭐ Aaron, 2026-08-29: "what do you think of adding presets for me to tag for the known canadian
// ownings? typing them out is tedious and repetitive lol... we could leave an option to input
// manually if its a US car or something totally different from what's known"

const car = (owningArea: string | null): OwningPresetVehicle => ({ owningArea });

describe('owningPresets', () => {
  it('⭐ orders by how common each branch is on the live fleet', () => {
    const fleet = [...Array(5)].map(() => car('8199')).concat([car('8193'), car('8193'), car('8191')]);
    expect(owningPresets(fleet).map(p => p.code)).toEqual(['8199', '8193', '8191']);
  });

  it('carries the label for the button title, never its face', () => {
    expect(owningPresets([car('8199')])[0]).toMatchObject({ code: '8199', label: 'Winnipeg (8199)', count: 1 });
  });

  it('⚠️⚠️ excludes a branch FG cannot NAME — this is how the US car stays manual', () => {
    // 2294 is the US branch on the Florida Compass and 8892 has never been confirmed. Neither is in
    // KNOWN, so neither can become a button — exactly the exclusion he asked for, for free.
    expect(owningPresets([car('2294'), car('8892')])).toEqual([]);
  });

  it('⚠️ excludes a named branch NO CAR CARRIES — 8999 is Winnipeg before the renumber', () => {
    // It stays in KNOWN so historical cars still read as Winnipeg; a button for it would invite
    // filing a car under a branch that no longer exists.
    expect(owningPresets([car('8199')]).map(p => p.code)).not.toContain('8999');
  });

  it('ignores cars with no owning area at all', () => {
    expect(owningPresets([car(null), car('  '), car('8199')]).map(p => p.code)).toEqual(['8199']);
  });

  it('breaks ties on the number, so the order is stable across reloads', () => {
    expect(owningPresets([car('8193'), car('8191')]).map(p => p.code)).toEqual(['8191', '8193']);
  });

  it('returns nothing rather than throwing on an empty fleet', () => {
    expect(owningPresets([])).toEqual([]);
  });
});
