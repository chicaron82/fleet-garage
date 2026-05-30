import { describe, it, expect, beforeEach } from 'vitest';
import { canFlagReservation, loadFlags, saveFlag, removeFlag } from '../../src/lib/manifestFlags';

beforeEach(() => {
  localStorage.clear();
});

const DAY = new Date('2026-05-22T12:00:00');

// ── canFlagReservation ────────────────────────────────────────────────────────

describe('canFlagReservation', () => {
  it('allows management + counter', () => {
    for (const role of ['Branch Manager', 'Operations Manager', 'City Manager', 'CSR'] as const) {
      expect(canFlagReservation(role)).toBe(true);
    }
  });

  it('denies floor roles', () => {
    expect(canFlagReservation('VSA')).toBe(false);
    expect(canFlagReservation('Driver')).toBe(false);
  });
});

// ── flag persistence (date-keyed) ─────────────────────────────────────────────

describe('manifest flag persistence', () => {
  it('starts empty', () => {
    expect(loadFlags(DAY).size).toBe(0);
  });

  it('saves and reloads a flag', () => {
    saveFlag('res-1', DAY);
    expect(loadFlags(DAY).has('res-1')).toBe(true);
  });

  it('removes a flag', () => {
    saveFlag('res-1', DAY);
    removeFlag('res-1', DAY);
    expect(loadFlags(DAY).has('res-1')).toBe(false);
  });

  it('keys flags by day — a different date does not see them', () => {
    saveFlag('res-1', DAY);
    const otherDay = new Date('2026-05-23T12:00:00');
    expect(loadFlags(otherDay).has('res-1')).toBe(false);
  });
});
