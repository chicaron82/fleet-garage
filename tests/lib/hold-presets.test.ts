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

  it('damage presets are the curated list, in order (13 categories + Other)', () => {
    expect(DAMAGE_PRESETS).toEqual([
      'Scratch — paint surface',
      'Scratch — to bare metal',
      'Dent — minor (no paint break)',
      'Dent — major / crumple',
      'Cracked windshield',
      'Windshield chip',
      'Broken glass (window / mirror)',
      'Mirror damage / missing',
      'Bumper damage — cosmetic',
      'Bumper damage — structural',
      'Collision',
      'Rim / hubcap damage',
      'Missing part / accessory',
      'Other',
    ]);
  });

  it('retired presets are gone (mechanical / interior / tire / repaired-chip)', () => {
    for (const gone of ['Mechanical concern', 'Interior stain', 'Interior damage (seat / trim)', 'Tire damage / flat', 'Windshield chip — repaired (scar remaining)']) {
      expect(DAMAGE_PRESETS).not.toContain(gone);
    }
  });
});
