import { describe, it, expect } from 'vitest';
import { DETAIL_REASON_LABELS } from '../../src/types';
import type { DetailReason } from '../../src/types';

// The canonical list of valid detail reasons
const ALL_DETAIL_REASONS: DetailReason[] = ['too-dirty', 'pet-hair', 'smoke-vape'];

describe('DETAIL_REASON_LABELS', () => {
  it('every DetailReason has a label', () => {
    for (const reason of ALL_DETAIL_REASONS) {
      expect(DETAIL_REASON_LABELS[reason]).toBeTruthy();
    }
  });

  it('too-dirty label is human-readable', () => {
    expect(DETAIL_REASON_LABELS['too-dirty']).toBe('Too dirty');
  });

  it('pet-hair label is human-readable', () => {
    expect(DETAIL_REASON_LABELS['pet-hair']).toBe('Pet hair');
  });

  it('smoke-vape label is human-readable', () => {
    expect(DETAIL_REASON_LABELS['smoke-vape']).toBe('Smoke / vape');
  });

  it('no extra keys beyond known reasons', () => {
    const keys = Object.keys(DETAIL_REASON_LABELS);
    expect(keys.length).toBe(ALL_DETAIL_REASONS.length);
  });
});

// ── Damage string construction (mirrors useNewHold finalDamage logic) ─────────
// Tested here as pure logic — no hook/React needed

function buildFinalDamage(
  holdType: 'damage' | 'detail',
  damageTypes: string[],
  customDamage: string,
  detailReason: DetailReason | '',
): string {
  if (holdType === 'detail') {
    return `Detail required — ${DETAIL_REASON_LABELS[detailReason as DetailReason] ?? ''}`;
  }
  return damageTypes
    .map(t => (t === 'Other' ? customDamage.trim() : t))
    .filter(Boolean)
    .join('; ');
}

describe('buildFinalDamage — damage holds', () => {
  it('single preset damage type', () => {
    expect(buildFinalDamage('damage', ['Scratch — paint surface'], '', '')).toBe('Scratch — paint surface');
  });

  it('multiple preset damage types joined with semicolon', () => {
    expect(buildFinalDamage('damage', ['Scratch — paint surface', 'Dent — minor (no paint break)'], '', '')).toBe(
      'Scratch — paint surface; Dent — minor (no paint break)'
    );
  });

  it('Other replaced with custom damage text', () => {
    expect(buildFinalDamage('damage', ['Other'], 'Cracked side mirror', '')).toBe('Cracked side mirror');
  });

  it('Other with empty custom damage is filtered out', () => {
    expect(buildFinalDamage('damage', ['Other'], '   ', '')).toBe('');
  });

  it('mixed preset and Other', () => {
    expect(buildFinalDamage('damage', ['Rim / hubcap damage', 'Other'], 'Cracked mirror', '')).toBe(
      'Rim / hubcap damage; Cracked mirror'
    );
  });

  it('empty selection returns empty string', () => {
    expect(buildFinalDamage('damage', [], '', '')).toBe('');
  });
});

describe('buildFinalDamage — detail holds', () => {
  it('too-dirty produces correct string', () => {
    expect(buildFinalDamage('detail', [], '', 'too-dirty')).toBe('Detail required — Too dirty');
  });

  it('pet-hair produces correct string', () => {
    expect(buildFinalDamage('detail', [], '', 'pet-hair')).toBe('Detail required — Pet hair');
  });

  it('smoke-vape produces correct string', () => {
    expect(buildFinalDamage('detail', [], '', 'smoke-vape')).toBe('Detail required — Smoke / vape');
  });

  it('damage types are ignored when holdType is detail', () => {
    expect(buildFinalDamage('detail', ['Scratch — paint surface'], '', 'too-dirty')).toBe(
      'Detail required — Too dirty'
    );
  });
});
