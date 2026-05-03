import { describe, it, expect } from 'vitest';
import { isStatDay, getStatName } from './stats';

describe('isStatDay', () => {
  it('recognises New Year\'s Day', () => {
    expect(isStatDay('2026-01-01')).toBe(true);
  });
  it('recognises Canada Day', () => {
    expect(isStatDay('2026-07-01')).toBe(true);
  });
  it('recognises Truth & Reconciliation Day', () => {
    expect(isStatDay('2026-09-30')).toBe(true);
  });
  it('recognises Remembrance Day', () => {
    expect(isStatDay('2026-11-11')).toBe(true);
  });
  it('recognises Christmas Day', () => {
    expect(isStatDay('2026-12-25')).toBe(true);
  });
  it('recognises Good Friday 2026 (Apr 3)', () => {
    expect(isStatDay('2026-04-03')).toBe(true);
  });
  it('recognises Good Friday 2025 (Apr 18)', () => {
    expect(isStatDay('2025-04-18')).toBe(true);
  });
  it('recognises Louis Riel Day 2026 — 3rd Monday of Feb', () => {
    expect(isStatDay('2026-02-16')).toBe(true);
  });
  it('recognises Victoria Day 2026 — last Monday on/before May 24', () => {
    expect(isStatDay('2026-05-18')).toBe(true);
  });
  it('recognises Terry Fox Day 2026 — 1st Monday of Aug', () => {
    expect(isStatDay('2026-08-03')).toBe(true);
  });
  it('recognises Labour Day 2026 — 1st Monday of Sep', () => {
    expect(isStatDay('2026-09-07')).toBe(true);
  });
  it('recognises Thanksgiving 2026 — 2nd Monday of Oct', () => {
    expect(isStatDay('2026-10-12')).toBe(true);
  });
  it('returns false for a regular weekday', () => {
    expect(isStatDay('2026-04-14')).toBe(false);
  });
  it('returns false for a Saturday that is not a stat', () => {
    expect(isStatDay('2026-04-11')).toBe(false);
  });
  it('works for a different year (Canada Day 2027)', () => {
    expect(isStatDay('2027-07-01')).toBe(true);
  });
});

describe('getStatName', () => {
  it('returns holiday name for a stat day', () => {
    expect(getStatName('2026-01-01')).toBe("New Year's Day");
  });
  it('returns Labour Day name', () => {
    expect(getStatName('2026-09-07')).toBe('Labour Day');
  });
  it('returns Good Friday name', () => {
    expect(getStatName('2026-04-03')).toBe('Good Friday');
  });
  it('returns null for a non-stat day', () => {
    expect(getStatName('2026-04-14')).toBeNull();
  });
  it('returns Thanksgiving name', () => {
    expect(getStatName('2026-10-12')).toBe('Thanksgiving');
  });
});
