import { describe, it, expect } from 'vitest';
import { decomposeOffStandard } from '../../src/components/analytics/shiftSummaryUtils';

// A day with both auto-logged airport runs (auto_from_trip) and manually-logged
// off-standard, mirroring the bug report: the airport time must land in exactly
// one bucket so the visible rows sum to the true total instead of inflating it.
const mixedDay = [
  { minutes: 42, reason: 'OTH',   autoFromTrip: true  }, // airport run
  { minutes: 39, reason: 'OTH',   autoFromTrip: true  }, // airport run
  { minutes: 60, reason: 'OTH',   autoFromTrip: false }, // opening duties
  { minutes: 12, reason: 'OTH',   autoFromTrip: false }, // EDV
  { minutes: 30, reason: 'WFW',   autoFromTrip: false }, // waiting for work
];

describe('decomposeOffStandard', () => {
  it('non-airport + airport equals the total (no double-count)', () => {
    const d = decomposeOffStandard(mixedDay);
    expect(d.airport).toBe(81);       // 42 + 39
    expect(d.nonAirport).toBe(102);   // 60 + 12 + 30
    expect(d.total).toBe(183);        // all five
    expect(d.nonAirport + d.airport).toBe(d.total);
  });

  it('breakdown counts only the non-airport entries', () => {
    const d = decomposeOffStandard(mixedDay);
    // The two airport OTH rows are excluded; only manual OTH (60+12) + WFW (30).
    expect(d.breakdown).toEqual({ OTH: 72, WFW: 30 });
  });

  it('an all-manual day has no airport time and a total equal to non-airport', () => {
    const d = decomposeOffStandard([
      { minutes: 25, reason: 'OTH', autoFromTrip: false },
      { minutes: 15, reason: 'CLASS', autoFromTrip: false },
    ]);
    expect(d.airport).toBe(0);
    expect(d.nonAirport).toBe(40);
    expect(d.total).toBe(40);
  });

  it('an all-airport day has no non-airport time and an empty breakdown', () => {
    const d = decomposeOffStandard([
      { minutes: 20, reason: 'OTH', autoFromTrip: true },
      { minutes: 18, reason: 'OTH', autoFromTrip: true },
    ]);
    expect(d.nonAirport).toBe(0);
    expect(d.airport).toBe(38);
    expect(d.total).toBe(38);
    expect(d.breakdown).toEqual({});
  });

  it('treats null minutes as zero', () => {
    const d = decomposeOffStandard([
      { minutes: null, reason: 'OTH', autoFromTrip: false },
      { minutes: 10,   reason: 'OTH', autoFromTrip: true  },
    ]);
    expect(d.nonAirport).toBe(0);
    expect(d.airport).toBe(10);
    expect(d.total).toBe(10);
  });

  it('an empty day is all zeros', () => {
    const d = decomposeOffStandard([]);
    expect(d).toEqual({ total: 0, nonAirport: 0, airport: 0, breakdown: {} });
  });
});
