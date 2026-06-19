import { describe, it, expect } from 'vitest';
import { othSessionLabel, elapsedLabel } from '../../src/lib/activeSessions';

describe('othSessionLabel', () => {
  it('prefers the preset name when present', () => {
    expect(othSessionLabel('OTH', 'airport_flip')).toBe('Flipping Returns');
    expect(othSessionLabel('OTH', 'fleeting_cars')).toBe('Fleeting Cars');
  });

  it('falls back to the reason full label when no preset', () => {
    expect(othSessionLabel('WFW', null)).toBe('Waiting for work');
    expect(othSessionLabel('MTG', null)).toBe('Meeting / Huddle');
  });
});

describe('elapsedLabel', () => {
  const start = '2026-06-19T15:00:00.000Z';
  const at = (mins: number) => new Date(start).getTime() + mins * 60_000;

  it('shows minutes under an hour', () => {
    expect(elapsedLabel(start, at(0))).toBe('0m');
    expect(elapsedLabel(start, at(23))).toBe('23m');
    expect(elapsedLabel(start, at(59))).toBe('59m');
  });

  it('shows h+m past an hour, zero-padding minutes', () => {
    expect(elapsedLabel(start, at(60))).toBe('1h 00m');
    expect(elapsedLabel(start, at(64))).toBe('1h 04m');
    expect(elapsedLabel(start, at(135))).toBe('2h 15m');
  });

  it('never goes negative (clock skew / future start)', () => {
    expect(elapsedLabel(start, at(-5))).toBe('0m');
  });
});
