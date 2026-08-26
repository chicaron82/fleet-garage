import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { SightingSummary } from '../../src/lib/sightings';

// ⚠️ THIS FILE ASSERTS THE SENTENCE, NOT THE HELPER — and the component's own comment says why:
// the last defect in this chip ("last last week", "last 3 days ago") was found by rendering the
// card at phone width, because every test asserted on describeLastSeen's OUTPUT rather than the
// sentence it lands in. Today's defect was the same class one level up: an all-time count welded
// to a latest date by a middot, composing a claim neither half made.
//
// Aaron, 2026-08-26: "how this reads is kinda deceiving. wouldn't every time I scan and open it be
// last seen today? fairly confident I cleaned it yesterday." He had.

let summary: SightingSummary;
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ recordKeyCount: vi.fn(), recordOdometer: vi.fn() }),
}));
vi.mock('../../src/hooks/useVehicleSightings', () => ({ useVehicleSightings: () => summary }));

import { VehicleRecordFacts } from '../../src/components/vehicle/VehicleRecordFacts';

const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();
const NOW = new Date().toISOString();

const chip = () => screen.getByText(/👁️/);
const show = (s: SightingSummary) => {
  summary = s;
  render(<VehicleRecordFacts vehicleId="v1" plate="LUR330" />);
};

describe('the last-seen chip', () => {
  // ⭐⭐ THE LIVE CASE. LUR330 had one scan yesterday 13:18 and one today 07:21, and the chip read
  // "Seen 2× · today" — which claims BOTH happened today.
  it('never welds an all-time count to a single date', () => {
    show({ lastSeenAt: NOW, priorSeenAt: YESTERDAY, count: 2, neverSeen: false });
    expect(chip()).not.toHaveTextContent('2× · today');
    expect(chip()).toHaveTextContent('Last here yesterday');
    expect(chip()).toHaveTextContent('2 scans');
  });

  // ⭐ The date answers "before this visit", because his own scan is what opened the record.
  it('reports the visit BEFORE this one, not the scan that opened the record', () => {
    show({ lastSeenAt: NOW, priorSeenAt: YESTERDAY, count: 2, neverSeen: false });
    expect(chip()).not.toHaveTextContent('today');
  });

  // ⚠️ A car scanned for the first time has no "before this" — it must say so rather than falling
  // back to the newest, which would print "today" again and rebuild the bug.
  it('says so on a first-ever scan instead of inventing a prior visit', () => {
    show({ lastSeenAt: NOW, priorSeenAt: null, count: 1, neverSeen: false });
    expect(chip()).toHaveTextContent('First scan');
    expect(chip()).not.toHaveTextContent('today');
  });

  it('still reads "never scanned" on day one — not an error, and most of the fleet', () => {
    show({ lastSeenAt: null, priorSeenAt: null, count: 0, neverSeen: true });
    expect(chip()).toHaveTextContent('Never scanned');
  });

  // ⭐ The stale case is the whole reason the feature exists — reached from Fleet with nothing
  // scanned, so prior IS the newest and the phrase has to survive intact.
  it('still makes him ask "where has that one been"', () => {
    const longAgo = new Date(Date.now() - 120 * 86_400_000).toISOString();
    show({ lastSeenAt: longAgo, priorSeenAt: longAgo, count: 3, neverSeen: false });
    expect(chip()).toHaveTextContent('Last here 4 months ago');
    expect(chip()).toHaveTextContent('3 scans');
  });

  // ⚠️ describeLastSeen returns a COMPLETE phrase, so a "last" prefix once produced "last
  // yesterday" and "last 3 days ago". "Last here <phrase>" must not reintroduce that.
  it('never doubles the word "last"', () => {
    for (const iso of [YESTERDAY, new Date(Date.now() - 3 * 86_400_000).toISOString()]) {
      show({ lastSeenAt: NOW, priorSeenAt: iso, count: 2, neverSeen: false });
      expect(chip().textContent).not.toMatch(/last\s+last/i);
      screen.getByText(/👁️/); // still one chip
      document.body.innerHTML = '';
    }
  });
});
