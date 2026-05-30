import { describe, it, expect, afterEach, vi } from 'vitest';
import { fuelColor, elapsedSince, fmtTime } from '../../src/lib/vsa-trip';

afterEach(() => {
  vi.useRealTimers();
});

// ── fuelColor ─────────────────────────────────────────────────────────────────

describe('fuelColor', () => {
  it('red at empty / near-empty (≤1)', () => {
    expect(fuelColor(0)).toBe('#ef4444');
    expect(fuelColor(1)).toBe('#ef4444');
  });

  it('orange at 2', () => {
    expect(fuelColor(2)).toBe('#f97316');
  });

  it('yellow at 3', () => {
    expect(fuelColor(3)).toBe('#eab308');
  });

  it('green from 4 up', () => {
    expect(fuelColor(4)).toBe('#22c55e');
    expect(fuelColor(8)).toBe('#22c55e');
  });
});

// ── elapsedSince ──────────────────────────────────────────────────────────────

describe('elapsedSince', () => {
  it('formats the gap from a past timestamp to now as "Xm YYs"', () => {
    vi.useFakeTimers();
    const now = new Date('2026-05-22T15:00:00Z');
    vi.setSystemTime(now);
    const past = new Date(now.getTime() - (3 * 60_000 + 7_000)).toISOString(); // 3m 7s ago
    expect(elapsedSince(past)).toBe('3m 07s');
  });

  it('zero-pads seconds', () => {
    vi.useFakeTimers();
    const now = new Date('2026-05-22T15:00:00Z');
    vi.setSystemTime(now);
    const past = new Date(now.getTime() - 5_000).toISOString(); // 0m 5s
    expect(elapsedSince(past)).toBe('0m 05s');
  });
});

// ── fmtTime ───────────────────────────────────────────────────────────────────

describe('fmtTime', () => {
  it('renders an HH:MM time string', () => {
    const local = new Date(2026, 4, 22, 14, 30);
    expect(fmtTime(local.toISOString())).toMatch(/\d{1,2}:\d{2}/);
  });
});
