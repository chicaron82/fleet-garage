import { describe, it, expect } from 'vitest';
import { DAMAGE_PRESETS, MECHANICAL_PRESET_META, MECHANICAL_PRESETS } from '../../src/lib/hold-presets';

const VALID_SUBTYPES = ['tire-swap', 'tire-repair', 'pm-due', 'safety-recall', 'other'];

describe('hold presets', () => {
  it('MECHANICAL_PRESETS is exactly the meta keys (stays in sync)', () => {
    expect(MECHANICAL_PRESETS).toEqual(Object.keys(MECHANICAL_PRESET_META));
  });

  it('every mechanical preset declares a valid subType', () => {
    for (const [, meta] of Object.entries(MECHANICAL_PRESET_META)) {
      expect(VALID_SUBTYPES).toContain(meta.subType);
    }
  });

  it('damage presets include the catch-all "Other"', () => {
    expect(DAMAGE_PRESETS).toContain('Other');
    expect(DAMAGE_PRESETS.length).toBeGreaterThan(0);
  });
});
