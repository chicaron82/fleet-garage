import { describe, it, expect, afterEach, vi } from 'vitest';
import { holdEmoji, HOLD_TYPE_EMOJI, getTireSwapSeason, holdBadgeConfig, holdContextEmojis, holdTypePillClass, unresolvedHoldTypes } from '../../src/lib/holdBadge';
import type { HoldType } from '../../src/types';
import { HOLD_TYPE_LABELS } from '../../src/lib/holdTypeLabels';

describe('unresolvedHoldTypes', () => {
  it('drops resolved types, keeps open ones (history stays in holdTypes)', () => {
    expect(unresolvedHoldTypes({ holdTypes: ['damage', 'mechanical'], resolvedTypes: ['mechanical'] }))
      .toEqual(['damage']);
  });
  it('returns all types when nothing is resolved', () => {
    expect(unresolvedHoldTypes({ holdTypes: ['damage', 'mechanical'], resolvedTypes: [] }))
      .toEqual(['damage', 'mechanical']);
  });
  it('returns empty when every type is resolved', () => {
    expect(unresolvedHoldTypes({ holdTypes: ['damage'], resolvedTypes: ['damage'] })).toEqual([]);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function atMonth(month1to12: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, month1to12 - 1, 15));
}

// ── getTireSwapSeason (summer = May–Aug) ──────────────────────────────────────

describe('getTireSwapSeason', () => {
  it('is summer ☀️ inside May–Aug', () => {
    atMonth(6);
    expect(getTireSwapSeason()).toBe('☀️');
  });

  it('is winter ❄️ outside that window', () => {
    atMonth(1);
    expect(getTireSwapSeason()).toBe('❄️');
  });

  it.each([[5, '☀️'], [8, '☀️'], [4, '❄️'], [9, '❄️']] as const)(
    'month %i → %s (boundary)',
    (m, expected) => {
      atMonth(m);
      expect(getTireSwapSeason()).toBe(expected);
    },
  );
});

// ── holdBadgeConfig ───────────────────────────────────────────────────────────

describe('holdBadgeConfig', () => {
  it('more than one hold type → Multi-Hold', () => {
    expect(holdBadgeConfig(['mechanical', 'detail']).label).toBe('🧩 Multi-Hold');
  });

  it('mechanical tire-swap shows the seasonal label', () => {
    atMonth(7); // summer
    expect(holdBadgeConfig(['mechanical'], 'tire-swap').label).toBe('☀️ Tire Swap');
  });

  it('mechanical tire-repair shows the tire-repair label', () => {
    expect(holdBadgeConfig(['mechanical'], 'tire-repair').label).toBe('🛞 Tire Repair');
  });

  it.each([
    ['mechanical', '🔧 Mechanical'],
    ['detail', '🧹 Detail'],
    ['sale_car', '🏷️ Sale Car'],
    ['damage', '💥 Damage'],
    ['missing_accessories', '🔌 Missing Assets'],
    ['hail', '⛈️ Hail'],
  ] as [HoldType, string][])('single %s hold → label %s', (type, label) => {
    expect(holdBadgeConfig([type]).label).toBe(label);
  });

  it('gives sale_car a distinct (teal) className vs damage (red)', () => {
    expect(holdBadgeConfig(['sale_car']).className).toContain('teal');
    expect(holdBadgeConfig(['damage']).className).toContain('red');
  });

  it('gives hail its own indigo className — not the damage-red default', () => {
    expect(holdBadgeConfig(['hail']).className).toContain('indigo');
    expect(holdBadgeConfig(['hail']).className).not.toContain('red');
  });
});

// ── holdContextEmojis ─────────────────────────────────────────────────────────

describe('holdContextEmojis', () => {
  it('flags out-on-exception vehicles', () => {
    expect(holdContextEmojis('OUT_ON_EXCEPTION', ['damage'])).toContain('⚠️');
  });

  it('adds the wrench for a bare mechanical hold', () => {
    expect(holdContextEmojis('HELD', ['mechanical'])).toContain('🔧');
  });

  it('adds pm-due and detail-reason emojis', () => {
    expect(holdContextEmojis('HELD', ['mechanical'], null, 'pm-due')).toContain('⚙️');
    expect(holdContextEmojis('HELD', ['detail'], 'smoke-vape')).toContain('🚬');
    expect(holdContextEmojis('HELD', ['detail'], 'pet-hair')).toContain('🐾');
  });

  it('adds the storm emoji for a hail hold', () => {
    expect(holdContextEmojis('HELD', ['hail'])).toContain('⛈️');
  });

  it('returns an empty list when nothing applies', () => {
    expect(holdContextEmojis('CLEAR', ['damage'])).toEqual([]);
  });
});

// ── holdTypePillClass ─────────────────────────────────────────────────────────

describe('holdTypePillClass', () => {
  it('colours each hold type distinctly', () => {
    expect(holdTypePillClass('mechanical')).toContain('orange');
    expect(holdTypePillClass('detail')).toContain('teal');
    expect(holdTypePillClass('sale_car')).toContain('purple');
    expect(holdTypePillClass('damage')).toContain('red');
    expect(holdTypePillClass('hail')).toContain('indigo');
  });
});

// ── tire-replacement (2026-09-13) ────────────────────────────────────────────────────────────────
// FG's two tire words were a PATCH and a SEASONAL SWAP. Aaron: "Low tread needs tire replacement."
// Different job, different money, different shop — so the preset stopped borrowing `tire-repair`.
describe('tire-replacement', () => {
  it('⭐ gets its own badge, distinct from a repair', () => {
    expect(holdBadgeConfig(['mechanical'], 'tire-replacement').label).toBe('🛞 Tire Replacement');
    expect(holdBadgeConfig(['mechanical'], 'tire-repair').label).toBe('🛞 Tire Repair');
  });

  it('does not fall through to the generic mechanical "Held"', () => {
    expect(holdBadgeConfig(['mechanical'], 'tire-replacement').label).not.toBe('Held');
  });

  it('carries the tire emoji without the generic wrench', () => {
    const emojis = holdContextEmojis('CLEAR', ['mechanical'], null, 'tire-replacement');
    expect(emojis).toContain('🛞');
    expect(emojis).not.toContain('🔧');   // 🔧 is for `other` — the bucket this just left
  });

  it('⚠️ a multi-hold still wins, so the sub-type cannot hide a second hold type', () => {
    expect(holdBadgeConfig(['mechanical', 'damage'], 'tire-replacement').label).toBe('🧩 Multi-Hold');
  });
});

describe('holdBadgeConfig — the badge says WHAT is held (Aaron, 2026-09-14)', () => {
  it('⭐ no known hold type falls back to the redundant word "Held"', () => {
    const types: HoldType[] = ['damage', 'hail', 'detail', 'mechanical', 'sale_car', 'missing_accessories'];
    for (const t of types) expect(holdBadgeConfig([t]).label).not.toBe('Held');
    for (const sub of ['tire-swap', 'tire-repair', 'tire-replacement', 'pm-due', 'safety-recall', 'other'] as const) {
      expect(holdBadgeConfig(['mechanical'], sub).label).not.toBe('Held');
    }
  });

  it('names the mechanical sub-types he sees most', () => {
    expect(holdBadgeConfig(['mechanical'], 'pm-due').label).toBe('⚙️ PM Due');
    expect(holdBadgeConfig(['mechanical'], 'safety-recall').label).toBe('⚠️ Safety Recall');
    expect(holdBadgeConfig(['mechanical'], 'other').label).toBe('🔧 Mechanical');
  });

  it('keeps Multi-Hold — "listing everything might be too much to show"', () => {
    expect(holdBadgeConfig(['damage', 'detail']).label).toBe('🧩 Multi-Hold');
  });
});

// Aaron, 2026-09-14: "plate things properly add emojis to the other badges too." Half the badges had
// an emoji and half didn't. This holds the shape so a future badge can't quietly ship bare.
describe('every hold badge is emoji + word', () => {
  const lead = (label: string) => /^\p{Extended_Pictographic}/u.test(label);
  it('⭐ no single-type badge renders without an emoji', () => {
    const types: HoldType[] = ['damage', 'hail', 'detail', 'mechanical', 'sale_car', 'missing_accessories'];
    for (const t of types) expect(lead(holdBadgeConfig([t]).label), t).toBe(true);
  });
  it('⭐ no mechanical sub-type badge renders without one, and neither does Multi-Hold', () => {
    for (const sub of ['tire-swap', 'tire-repair', 'tire-replacement', 'pm-due', 'safety-recall', 'other'] as const)
      expect(lead(holdBadgeConfig(['mechanical'], sub).label), sub).toBe(true);
    expect(lead(holdBadgeConfig(['damage', 'detail']).label)).toBe(true);
  });
  // ⚠️ The wrench is Mechanical's. Two badges sharing a glyph would undo the point of the emoji.
  it('⚠️ damage and mechanical never share a glyph', () => {
    const g = (l: string) => [...l][0];
    expect(g(holdBadgeConfig(['damage']).label)).not.toBe(g(holdBadgeConfig(['mechanical']).label));
  });
});

// ⭐ ONE EMOJI PER HOLD TYPE (2026-09-14). The re-hold form had 🔧/⚙️ swapped and the scan sheet put 🔧
// in front of every type. These pin the one source the surfaces now read.
describe('holdEmoji / HOLD_TYPE_EMOJI — one glyph per type', () => {
  it('⭐ every hold type has its own, and no two share one', () => {
    const glyphs = Object.values(HOLD_TYPE_EMOJI);
    expect(Object.keys(HOLD_TYPE_EMOJI).sort()).toEqual(['damage', 'detail', 'hail', 'mechanical', 'missing_accessories', 'sale_car']);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
  it('⚠️ the wrench is mechanical, never damage', () => {
    expect(HOLD_TYPE_EMOJI.mechanical).toBe('🔧');
    expect(HOLD_TYPE_EMOJI.damage).not.toBe('🔧');
  });
  it('a multi-type hold is 🧩; mechanical sub-types refine the glyph', () => {
    expect(holdEmoji(['damage', 'hail'])).toBe('🧩');
    expect(holdEmoji(['mechanical'], 'pm-due')).toBe('⚙️');
    expect(holdEmoji(['mechanical'], 'tire-replacement')).toBe('🛞');
    expect(holdEmoji(['mechanical'], 'safety-recall')).toBe('⚠️');
    expect(holdEmoji(['mechanical'], 'other')).toBe('🔧');
    expect(holdEmoji(['hail'])).toBe('⛈️');
  });
  it('⭐ every badge leads with exactly what holdEmoji says — the badge cannot drift from the source', () => {
    for (const t of Object.keys(HOLD_TYPE_EMOJI) as HoldType[])
      expect(holdBadgeConfig([t]).label.startsWith(holdEmoji([t]))).toBe(true);
    for (const sub of ['tire-repair', 'tire-replacement', 'pm-due', 'safety-recall'] as const)
      expect(holdBadgeConfig(['mechanical'], sub).label.startsWith(holdEmoji(['mechanical'], sub))).toBe(true);
  });
});

// ⚠️ One name per hold type (2026-09-14): the badge said "Missing Assets" while the label list said
// "Missing Accessories". The badge now reads its word from HOLD_TYPE_LABELS; this holds them together.
describe('badge words come from HOLD_TYPE_LABELS', () => {
  it('⭐ every single-type badge is exactly  emoji + the canonical label', () => {
    for (const t of Object.keys(HOLD_TYPE_LABELS) as HoldType[])
      expect(holdBadgeConfig([t]).label).toBe(`${HOLD_TYPE_EMOJI[t]} ${HOLD_TYPE_LABELS[t]}`);
  });
});
