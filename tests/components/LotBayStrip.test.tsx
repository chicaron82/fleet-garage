// Erin St's strip, on /lot and the read-only /lot/view. Aaron, 2026-10-15: each count is a snapshot, true as of
// its time; and the read-only view is about the count, not about who is in the bay — so times, never initials.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LotBayStrip } from '../../src/components/lot/LotBayStrip';
import type { LotBay } from '../../src/lib/lotBay';

const NOW = Date.parse('2026-10-15T16:30:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();
const bay = (over: Partial<LotBay> = {}): LotBay => ({
  cleans: 6, cleansBy: 'AS', cleansAt: minsAgo(3), dirties: 23, dirtiesBy: 'AS', dirtiesAt: minsAgo(12), used: 4, usedOn: '2026-10-15', ...over,
});

describe('LotBayStrip', () => {
  it('shows both counts, each with its own "as of" time', () => {
    render(<LotBayStrip bay={bay()} nowMs={NOW} />);
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByText(/as of 11:27 · 3 min ago/)).toBeTruthy();
    expect(screen.getByText(/as of 11:18 · 12 min ago/)).toBeTruthy();
  });

  it('⚠️ never shows who tapped', () => {
    const { container } = render(<LotBayStrip bay={bay()} nowMs={NOW} />);
    expect(container.textContent).not.toContain('AS');
  });

  it('a count over 30 min old turns amber; a fresh one keeps its colour', () => {
    render(<LotBayStrip bay={bay({ cleansAt: minsAgo(45) })} nowMs={NOW} />);
    expect(screen.getByText('6').className).toContain('text-amber-700');
    expect(screen.getByText('23').className).toContain('text-red-700');
  });

  it('a dirty count never typed reads as not counted, not as 0', () => {
    render(<LotBayStrip bay={bay({ dirties: null, dirtiesAt: null })} nowMs={NOW} />);
    expect(screen.getByText('–')).toBeTruthy();
    expect(screen.getByText('not counted yet')).toBeTruthy();
  });
});
