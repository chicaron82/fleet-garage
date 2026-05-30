import { describe, it, expect, afterEach, vi } from 'vitest';
import { getTireSwapSeason, holdBadgeConfig, holdContextEmojis, holdTypePillClass } from '../../src/lib/holdBadge';
import type { HoldType } from '../../src/types';

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
    expect(holdBadgeConfig(['mechanical', 'detail']).label).toBe('Multi-Hold');
  });

  it('mechanical tire-swap shows the seasonal label', () => {
    atMonth(7); // summer
    expect(holdBadgeConfig(['mechanical'], 'tire-swap').label).toBe('☀️ Tire Swap');
  });

  it('mechanical tire-repair shows the tire-repair label', () => {
    expect(holdBadgeConfig(['mechanical'], 'tire-repair').label).toBe('🛞 Tire Repair');
  });

  it.each([
    ['mechanical', 'Held'],
    ['detail', 'Held'],
    ['sale_car', 'Sale Car'],
    ['damage', 'Held'],
  ] as [HoldType, string][])('single %s hold → label %s', (type, label) => {
    expect(holdBadgeConfig([type]).label).toBe(label);
  });

  it('gives sale_car a distinct (teal) className vs damage (red)', () => {
    expect(holdBadgeConfig(['sale_car']).className).toContain('teal');
    expect(holdBadgeConfig(['damage']).className).toContain('red');
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
  });
});
