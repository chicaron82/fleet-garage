import { describe, it, expect } from 'vitest';
import {
  reducesDenominator,
  morningHandoffBoundary,
  splitOffStandard,
  buildShiftPartition,
  computeShiftRates,
  applyShiftWindow,
  resolveShiftRates,
  shiftRateWarning,
  deriveShiftWindow,
  deriveUserShift,
  deriveUserShiftType,
  pickShift,
  MORNING_SHIFT_HOURS,
  CLOSING_SHIFT_HOURS,
  type ShiftPartition,
  type ShiftSnapshot,
  type OffStandardMinutes,
} from '../../src/lib/shift-metrics';
import { sentToFleet, type SentToFleetInput } from '../../src/lib/washbay-throughput';
import { localDateStr } from '../../src/hooks/useFleetBalance';
import type { HandoffNote, ShiftCheckpoint, ShiftWithUser } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeHandoff(over: Partial<HandoffNote> = {}): HandoffNote {
  return {
    id: 'h1',
    branchId: 'YWG',
    loggedById: 'u1',
    loggedByName: 'Ana',
    loggedAt: '2026-05-22T15:15:00',
    fullPages: 2,
    lastPageEntries: 5,        // 2*19 + 5 = 43
    teamSize: 4,
    lotStatus: 'manageable',
    morningHours: 8,
    ...over,
  };
}

function makeCheckpoint(over: Partial<ShiftCheckpoint> = {}): ShiftCheckpoint {
  return {
    id: 'cp1',
    branchId: 'YWG',
    date: '2026-05-22',
    checkpointType: 'closing_arrival',
    fullPages: 3,
    lastPageEntries: 0,        // 3*19 = 57
    loggedBy: 'u1',
    loggedAt: '2026-05-22T15:30:00',
    ...over,
  };
}

function makeShift(over: Partial<ShiftWithUser>): ShiftWithUser {
  return {
    id: 's1',
    userId: 'u1',
    date: localDateStr(0),
    shiftType: 'opening',
    createdAt: '',
    updatedAt: '',
    branchId: 'YWG',
    user: { name: 'Ana', role: 'VSA' },
    ...over,
  };
}

// ── morningHandoffBoundary ────────────────────────────────────────────────────

describe('morningHandoffBoundary', () => {
  it('returns 15:15 local on the handoff date', () => {
    const b = morningHandoffBoundary(makeHandoff({ loggedAt: '2026-05-22T09:00:00' }));
    expect(b.getHours()).toBe(15);
    expect(b.getMinutes()).toBe(15);
  });

  it('anchors a post-midnight handoff to its shift-day (the prior date), not the calendar date', () => {
    // Logged 01:00 on the 23rd is still the 22nd's shift (04:00 cutover) → boundary is the 22nd 15:15.
    const b = morningHandoffBoundary(makeHandoff({ loggedAt: '2026-05-23T01:00:00' }));
    expect(b.getDate()).toBe(22);
    expect(b.getHours()).toBe(15);
    expect(b.getMinutes()).toBe(15);
  });
});

// ── splitOffStandard ──────────────────────────────────────────────────────────

describe('splitOffStandard', () => {
  it('counts everything as morning when there is no boundary', () => {
    const entries = [
      { startTime: '2026-05-22T08:00:00', minutes: 10 },
      { startTime: '2026-05-22T20:00:00', minutes: 25 },
    ];
    expect(splitOffStandard(entries, null)).toEqual({ morning: 35, closing: 0 });
  });

  it('partitions entries strictly before / on-or-after the boundary', () => {
    const boundary = new Date('2026-05-22T15:15:00');
    const before = new Date(boundary.getTime() - 60 * 60_000).toISOString(); // 1h before
    const after  = new Date(boundary.getTime() + 60 * 60_000).toISOString(); // 1h after
    const atBoundary = boundary.toISOString();                               // exactly on → closing
    const entries = [
      { startTime: before, minutes: 12 },
      { startTime: after,  minutes: 30 },
      { startTime: atBoundary, minutes: 5 },
    ];
    expect(splitOffStandard(entries, boundary)).toEqual({ morning: 12, closing: 35 });
  });

  it('returns zeroes for an empty list', () => {
    expect(splitOffStandard([], new Date('2026-05-22T15:15:00'))).toEqual({ morning: 0, closing: 0 });
  });
});

// ── buildShiftPartition ───────────────────────────────────────────────────────

describe('buildShiftPartition', () => {
  it('no handoff → morning cleaned null, default hours, OTH all morning', () => {
    const p = buildShiftPartition({
      handoff: null,
      checkpoint: null,
      fullDayCleaned: 100,
      offStandardEntries: [{ startTime: '2026-05-22T20:00:00', minutes: 15 }],
    });
    expect(p.morning.cleaned).toBeNull();
    expect(p.morning.hours).toBe(MORNING_SHIFT_HOURS);
    expect(p.morning.oth).toBe(15);   // no boundary → all morning
    expect(p.closing.cleaned).toBeNull(); // no closingStartCount
  });

  it('handoff, no checkpoint → closing starts at the morning count', () => {
    const p = buildShiftPartition({
      handoff: makeHandoff({ morningHours: 7.5 }), // morningCleaned = 43
      checkpoint: null,
      fullDayCleaned: 100,
      offStandardEntries: [],
    });
    expect(p.morning.cleaned).toBe(43);
    expect(p.morning.hours).toBe(7.5);
    expect(p.closing.cleaned).toBe(57);  // max(0, 100 - 43)
    expect(p.closing.hours).toBe(CLOSING_SHIFT_HOURS);
  });

  it('checkpoint overrides the closing start count', () => {
    const p = buildShiftPartition({
      handoff: makeHandoff(),       // 43
      checkpoint: makeCheckpoint(), // 57
      fullDayCleaned: 100,
      offStandardEntries: [],
    });
    expect(p.closing.cleaned).toBe(43); // max(0, 100 - 57)
  });

  it('clamps closing cleaned at zero when start exceeds the full-day count', () => {
    const p = buildShiftPartition({
      handoff: makeHandoff(),
      checkpoint: makeCheckpoint({ fullPages: 10, lastPageEntries: 0 }), // 190
      fullDayCleaned: 100,
      offStandardEntries: [],
    });
    expect(p.closing.cleaned).toBe(0);
  });

  it('splits OTH across the handoff boundary', () => {
    const boundary = new Date('2026-05-22T15:15:00');
    const before = new Date(boundary.getTime() - 30 * 60_000).toISOString();
    const after  = new Date(boundary.getTime() + 30 * 60_000).toISOString();
    const p = buildShiftPartition({
      handoff: makeHandoff(),
      checkpoint: null,
      fullDayCleaned: 100,
      offStandardEntries: [
        { startTime: before, minutes: 20 },
        { startTime: after,  minutes: 40 },
      ],
    });
    expect(p.morning.oth).toBe(20);
    expect(p.closing.oth).toBe(40);
  });

  it('computes a mid window from arrival/departure checkpoints', () => {
    const midArrival   = makeCheckpoint({ fullPages: 2, lastPageEntries: 0, loggedAt: '2026-05-22T11:00:00' }); // 38
    const midDeparture = makeCheckpoint({ fullPages: 5, lastPageEntries: 0, loggedAt: '2026-05-22T19:00:00' }); // 95
    const p = buildShiftPartition({
      handoff: makeHandoff(),
      checkpoint: null,
      fullDayCleaned: 100,
      offStandardEntries: [
        { startTime: '2026-05-22T12:00:00', minutes: 18 }, // within mid window
        { startTime: '2026-05-22T22:00:00', minutes: 9 },  // outside mid window
      ],
      midArrival,
      midDeparture,
    });
    expect(p.mid.cleaned).toBe(57);            // max(0, 95 - 38)
    expect(p.mid.hours).toBe(CLOSING_SHIFT_HOURS);
    expect(p.mid.oth).toBe(18);                // only the in-window entry
  });

  it('mid OTH falls back to the full total without mid checkpoints', () => {
    const p = buildShiftPartition({
      handoff: makeHandoff(),
      checkpoint: null,
      fullDayCleaned: 100,
      offStandardEntries: [
        { startTime: '2026-05-22T12:00:00', minutes: 18 },
        { startTime: '2026-05-22T22:00:00', minutes: 9 },
      ],
    });
    expect(p.mid.cleaned).toBeNull();
    expect(p.mid.oth).toBe(27);
  });
});

// ── computeShiftRates ─────────────────────────────────────────────────────────

describe('computeShiftRates', () => {
  it('returns nulls when cleaned is unknown', () => {
    expect(computeShiftRates({ cleaned: null, hours: 8, oth: 0 })).toEqual({ baseline: null, yourEffort: null });
  });

  it('baseline and yourEffort are equal with no OTH', () => {
    const r = computeShiftRates({ cleaned: 80, hours: 8, oth: 0 });
    expect(r.baseline).toBe(10);
    expect(r.yourEffort).toBe(10);
  });

  it('logging OTH raises yourEffort above baseline (intentional)', () => {
    const r = computeShiftRates({ cleaned: 80, hours: 8, oth: 120 }); // 2h OTH → adjusted 6h
    expect(r.baseline).toBe(10);
    expect(r.yourEffort).toBeCloseTo(80 / 6, 5);
    expect(r.yourEffort!).toBeGreaterThan(r.baseline!);
  });

  it('clamps adjusted hours to a 0.1 floor so OTH ≥ shift hours never divides by zero', () => {
    const r = computeShiftRates({ cleaned: 5, hours: 8, oth: 600 }); // 10h OTH > 8h shift
    expect(r.yourEffort).toBeCloseTo(50, 5); // 5 / 0.1
  });

  it('baseline is null when shift hours are zero', () => {
    const r = computeShiftRates({ cleaned: 5, hours: 0, oth: 0 });
    expect(r.baseline).toBeNull();
    expect(r.yourEffort).toBeCloseTo(50, 5); // 5 / max(0.1, 0)
  });
});

// ── deriveShiftWindow ─────────────────────────────────────────────────────────

describe('deriveShiftWindow', () => {
  it('maps shift types to windows', () => {
    expect(deriveShiftWindow('opening')).toBe('morning');
    expect(deriveShiftWindow('closing')).toBe('closing');
    expect(deriveShiftWindow('mid')).toBe('mid');
  });

  it('returns null for non-working / unknown types', () => {
    expect(deriveShiftWindow('day-off')).toBeNull();
    expect(deriveShiftWindow('pto')).toBeNull();
    expect(deriveShiftWindow(null)).toBeNull();
    expect(deriveShiftWindow(undefined)).toBeNull();
  });
});

// ── deriveUserShiftType ───────────────────────────────────────────────────────

describe('deriveUserShiftType', () => {
  it('returns null when the user has no shift today', () => {
    const shifts = [makeShift({ userId: 'other', shiftType: 'closing' })];
    expect(deriveUserShiftType(shifts, 'u1')).toBeNull();
  });

  it('ignores shifts on other dates', () => {
    const shifts = [makeShift({ date: '2000-01-01', shiftType: 'closing' })];
    expect(deriveUserShiftType(shifts, 'u1')).toBeNull();
  });

  it('prefers a shift that has start/end times', () => {
    const shifts = [
      makeShift({ id: 'a', shiftType: 'pto' }),                                    // no times
      makeShift({ id: 'b', shiftType: 'closing', startTime: '13:30', endTime: '22:00' }),
    ];
    expect(deriveUserShiftType(shifts, 'u1')).toBe('closing');
  });

  it('falls back to the first shift when none have times', () => {
    const shifts = [makeShift({ id: 'a', shiftType: 'opening' })];
    expect(deriveUserShiftType(shifts, 'u1')).toBe('opening');
  });
});

// ── pickShift ─────────────────────────────────────────────────────────────────

describe('pickShift', () => {
  const partition: ShiftPartition = {
    morning: { cleaned: 1, hours: 8, oth: 0 },
    closing: { cleaned: 2, hours: 8, oth: 0 },
    mid:     { cleaned: 3, hours: 8, oth: 0 },
  };

  it('selects the snapshot for each window', () => {
    expect(pickShift(partition, 'morning')).toBe(partition.morning);
    expect(pickShift(partition, 'mid')).toBe(partition.mid);
    expect(pickShift(partition, 'closing')).toBe(partition.closing);
  });
});

// ── applyActualWindow ─────────────────────────────────────────────────────────

describe('applyShiftWindow', () => {
  const date = '2026-06-02';
  const baseSnap: ShiftSnapshot = { cleaned: 54, hours: 8, oth: 80 };
  const entries = [
    { startTime: '2026-06-02T11:00:00', minutes: 90 }, // in window
    { startTime: '2026-06-02T18:00:00', minutes: 60 }, // in window
    { startTime: '2026-06-02T09:00:00', minutes: 30 }, // before 10:30 start → excluded
  ];

  it('returns the snapshot unchanged when no window is available (no actual, no planned)', () => {
    expect(applyShiftWindow(baseSnap, { date, offStandardEntries: entries })).toEqual(baseSnap);
    // partial actual + no planned → still nothing to apply
    expect(applyShiftWindow(baseSnap, { date, actualStart: '10:30', offStandardEntries: entries })).toEqual(baseSnap);
  });

  it('derives productive hours from the actual span minus the unpaid break', () => {
    // 10:30 → 20:00 = 9.5h clock − 0.5 lunch = 9.0h
    const out = applyShiftWindow(baseSnap, { date, actualStart: '10:30', actualEnd: '20:00', offStandardEntries: [] });
    expect(out.hours).toBeCloseTo(9.0);
  });

  it('scopes off-standard to the window and leaves cars untouched', () => {
    const out = applyShiftWindow(baseSnap, { date, actualStart: '10:30', actualEnd: '20:00', offStandardEntries: entries });
    expect(out.oth).toBe(150); // 90 + 60; the 09:00 entry is before the window
    expect(out.cleaned).toBe(54);
  });

  it('produces the honest effort rate for a heavy-trip shift (Aaron 2026-06-02)', () => {
    // 54 cars, 10:30–20:00 (9.0h productive), 4h24m OTH all inside the window
    const out = applyShiftWindow(
      { cleaned: 54, hours: 8, oth: 80 },
      { date, actualStart: '10:30', actualEnd: '20:00', offStandardEntries: [{ startTime: '2026-06-02T12:00:00', minutes: 264 }] },
    );
    const { baseline, yourEffort } = computeShiftRates(out);
    expect(baseline).toBeCloseTo(6.0);       // 54 / 9
    expect(yourEffort).toBeCloseTo(11.7, 1); // 54 / (9 − 4.4)
  });

  it('handles a window that crosses midnight', () => {
    // 16:00 → 00:30 = 8.5h clock − 0.5 = 8.0h
    const out = applyShiftWindow(baseSnap, { date, actualStart: '16:00', actualEnd: '00:30', offStandardEntries: [] });
    expect(out.hours).toBeCloseTo(8.0);
  });

  it('falls back to planned start/end when actual hours are not logged (#2)', () => {
    // planned 06:45 → 15:15 = 8.5h − 0.5 = 8.0h
    const out = applyShiftWindow(baseSnap, { date, plannedStart: '06:45', plannedEnd: '15:15', offStandardEntries: [] });
    expect(out.hours).toBeCloseTo(8.0);
  });

  it('prefers actual over planned, taken as pairs (never mixed)', () => {
    // actual 10:30→20:00 (9.0h) wins over planned 06:45→15:15
    const out = applyShiftWindow(baseSnap, {
      date, actualStart: '10:30', actualEnd: '20:00', plannedStart: '06:45', plannedEnd: '15:15', offStandardEntries: [],
    });
    expect(out.hours).toBeCloseTo(9.0);
  });

  it('does NOT subtract a lunch break on a short call-in (#4)', () => {
    // 11:00 → 14:00 = 3.0h span, under the 5h threshold → no break deducted
    const out = applyShiftWindow(baseSnap, { date, actualStart: '11:00', actualEnd: '14:00', offStandardEntries: [] });
    expect(out.hours).toBeCloseTo(3.0);
  });

  it('still subtracts the break once the span exceeds 5h', () => {
    // 09:00 → 15:00 = 6.0h − 0.5 = 5.5h
    const out = applyShiftWindow(baseSnap, { date, actualStart: '09:00', actualEnd: '15:00', offStandardEntries: [] });
    expect(out.hours).toBeCloseTo(5.5);
  });
});

describe('deriveUserShift', () => {
  it('returns the user’s shift for the date, preferring one with start/end times', () => {
    const shifts = [
      makeShift({ id: 'a', userId: 'u1', date: '2026-06-02', shiftType: 'day-off' }),
      makeShift({ id: 'b', userId: 'u1', date: '2026-06-02', shiftType: 'mid', startTime: '10:30', endTime: '19:00' }),
    ];
    expect(deriveUserShift(shifts, 'u1', '2026-06-02')?.id).toBe('b');
  });
  it('returns null when the user has no shift that date', () => {
    expect(deriveUserShift([makeShift({ userId: 'u2', date: '2026-06-02' })], 'u1', '2026-06-02')).toBeNull();
  });
});

// ── resolveShiftRates — the one seam the card AND the report compute through ────

describe('resolveShiftRates', () => {
  const date = '2026-06-02';
  const partition: ShiftPartition = {
    morning: { cleaned: 40, hours: 8, oth: 0 },
    closing: { cleaned: 20, hours: 8, oth: 0 },
    mid:     { cleaned: 54, hours: 8, oth: 0 },
  };

  it('picks the user’s window and rates it over their actual hours', () => {
    const r = resolveShiftRates({
      partition, date,
      shift: { shiftType: 'mid', actualStartTime: '10:30', actualEndTime: '20:00' },
      offStandardEntries: [{ startTime: '2026-06-02T12:00:00', minutes: 264 }],
    });
    expect(r.snapshot.hours).toBeCloseTo(9.0);
    expect(r.baseline).toBeCloseTo(6.0);
    expect(r.yourEffort).toBeCloseTo(11.7, 1);
  });

  it('falls back to planned times when actual hours are absent', () => {
    const r = resolveShiftRates({
      partition, date,
      shift: { shiftType: 'mid', startTime: '06:45', endTime: '15:15' }, // 8.0h window
      offStandardEntries: [],
    });
    expect(r.snapshot.hours).toBeCloseTo(8.0);
    expect(r.baseline).toBeCloseTo(54 / 8);
  });

  it('uses the snapshot default when there is no shift at all', () => {
    const r = resolveShiftRates({ partition, date, shift: null, offStandardEntries: [] });
    expect(r.snapshot.hours).toBe(8);          // morning default window
    expect(r.baseline).toBeCloseTo(40 / 8);    // defaults to the morning snapshot
  });

  it('is deterministic — identical inputs give identical rates (card ↔ report parity)', () => {
    const args = {
      partition, date,
      shift: { shiftType: 'closing' as const, actualStartTime: '11:00', actualEndTime: '22:00' },
      offStandardEntries: [{ startTime: '2026-06-02T13:00:00', minutes: 120 }],
    };
    // Both surfaces call this same function with the same data, so their rates
    // cannot diverge. Lock that property.
    expect(resolveShiftRates(args)).toEqual(resolveShiftRates(args));
  });
});

// ── shiftRateWarning — catch a mis-logged count before it becomes the next 540 ──

describe('shiftRateWarning', () => {
  it('flags off-standard meeting or exceeding the whole window (the 540 condition)', () => {
    const w = shiftRateWarning({ cleaned: 50, hours: 2, oth: 150 }); // 2.5h OTH ≥ 2h window
    expect(w).toMatch(/off-standard/i);
  });

  it('flags an implausibly high effort rate (> 20/hr)', () => {
    const w = shiftRateWarning({ cleaned: 50, hours: 2, oth: 0 }); // 25/hr
    expect(w).toMatch(/25\.0\/hr/);
  });

  it('stays quiet for a legit heavy-trip rate (11.7/hr)', () => {
    expect(shiftRateWarning({ cleaned: 54, hours: 9, oth: 264 })).toBeNull();
  });

  it('stays quiet when there is no count yet', () => {
    expect(shiftRateWarning({ cleaned: null, hours: 8, oth: 0 })).toBeNull();
  });
});

// ── Denominator exemptions, carry-over credit & the sent-to-fleet seam ─────────
// Merged from the former src/lib/shift-metrics.test.ts (2026-06-08): fleeting_sent
// exclusion, carryOverCleared morning credit, and the sentToFleet → buildShiftPartition
// seam. None of this is covered above — keep both halves.

describe('reducesDenominator', () => {
  it('excludes fleeting_sent (cars shipped — already counted in sent-to-fleet)', () => {
    expect(reducesDenominator({ presetReason: 'fleeting_sent' })).toBe(false);
  });
  it('excludes edv (extra-detail time is cleaning — the slow car already counts)', () => {
    expect(reducesDenominator({ presetReason: 'edv' })).toBe(false);
  });
  it('excludes airport_flip (cleaning done off-site — never reaches the washbay rate)', () => {
    expect(reducesDenominator({ presetReason: 'airport_flip' })).toBe(false);
  });
  it('includes plain fleeting_cars (prep that stayed on the lot)', () => {
    expect(reducesDenominator({ presetReason: 'fleeting_cars' })).toBe(true);
  });
  it('includes entries with no preset', () => {
    expect(reducesDenominator({})).toBe(true);
    expect(reducesDenominator({ presetReason: null })).toBe(true);
  });
});

describe('splitOffStandard excludes fleeting_sent', () => {
  const boundary = new Date('2026-06-05T15:15:00');
  const entries: OffStandardMinutes[] = [
    { startTime: '2026-06-05T09:00:00', minutes: 30, presetReason: 'fleeting_cars' }, // morning, reduces
    { startTime: '2026-06-05T10:00:00', minutes: 45, presetReason: 'fleeting_sent' }, // morning, EXEMPT
    { startTime: '2026-06-05T18:00:00', minutes: 20, presetReason: 'fleeting_sent' }, // closing, EXEMPT
    { startTime: '2026-06-05T19:00:00', minutes: 15 },                                // closing, reduces
  ];

  it('counts only denominator-reducing minutes per window', () => {
    expect(splitOffStandard(entries, boundary)).toEqual({ morning: 30, closing: 15 });
  });

  it('with no boundary, sums only reducible minutes into morning', () => {
    expect(splitOffStandard(entries, null)).toEqual({ morning: 45, closing: 0 });
  });
});

// handoff: 2 full pages + 2 entries = 2*19+2 = 40 cars on the gas sheet
const HANDOFF_40 = {
  fullPages: 2, lastPageEntries: 2,
  loggedAt: '2026-06-05T15:15:00',
  morningHours: 8,
};

describe('buildShiftPartition — carryOverCleared credits morning, keeps closing boundary on morningGas', () => {
  it('with carryOverCleared=5: morning.cleaned=45, closing.cleaned=20 (boundary = 40, not 45)', () => {
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(45);  // 40 gas + 5 carry-over credited to morning
    expect(result.closing.cleaned).toBe(20);  // 60 − 40 (morningGas boundary, not 45)
  });

  it('daily total = fullDayCleaned + carryOverCleared (carry-over not double-subtracted)', () => {
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned! + result.closing.cleaned!).toBe(65); // 60 + 5
  });

  it('with no carryOverCleared (omitted): partition unchanged from Phase 1 behaviour', () => {
    const result = buildShiftPartition({
      handoff: HANDOFF_40,
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(40);
    expect(result.closing.cleaned).toBe(20);
    expect(result.morning.cleaned! + result.closing.cleaned!).toBe(60);
  });

  it('checkpoint overrides morningGas as closing boundary even with carryOverCleared', () => {
    // checkpoint at 45 cars; carryOverCleared=5 → morningCleaned=45, but boundary=45 from checkpoint
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: { fullPages: 2, lastPageEntries: 7, loggedAt: '2026-06-05T16:00:00' }, // 2*19+7=45
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(45);  // 40 + 5 carry-over
    expect(result.closing.cleaned).toBe(15);  // 60 − 45 (checkpoint boundary wins)
  });
});

// The seam ShiftRatesCard wires: sentToFleet(log) → fullDayCleaned → partition.
// buildShiftPartition's own tests pass fullDayCleaned as a literal; nothing pins
// that the literal is the *corrected* sent-to-fleet number. These tests compose
// the two pure functions so a change to either side (a dropped sentToFleet term,
// or the partition recomputing instead of consuming) breaks here, not in prod.
describe('sentToFleet → buildShiftPartition seam', () => {
  // 3 pages + 0 = 57 fuelled; − 8 queue − 3 parked + 4 deferred = 50 sent.
  const LOG: SentToFleetInput = {
    fullPages: 3, lastPageEntries: 0,
    carsRemaining: 8, nonRentablesFuelled: 3, deferredCompletions: 4,
  };
  const closingClean = (over: Partial<SentToFleetInput> = {}) =>
    buildShiftPartition({
      handoff: HANDOFF_40,                 // morningGas boundary = 40
      checkpoint: null,
      fullDayCleaned: sentToFleet({ ...LOG, ...over }),
      offStandardEntries: [],
    }).closing.cleaned;

  it('closing.cleaned tracks the net-shipped number, not the raw gas count', () => {
    expect(sentToFleet(LOG)).toBe(50);
    expect(closingClean()).toBe(10);            // 50 sent − 40 boundary
    expect(closingClean()).not.toBe(57 - 40);   // the corrections flow through, not raw 57
  });

  it('every sentToFleet correction moves closing.cleaned one-for-one', () => {
    expect(closingClean({ deferredCompletions: 5 })).toBe(11); // +1 deferred → +1 shipped
    expect(closingClean({ carsRemaining: 9 })).toBe(9);        // +1 left in queue → −1 shipped
    expect(closingClean({ nonRentablesFuelled: 4 })).toBe(9);  // +1 parked → −1 shipped
  });

  it('the corrected number reaches the rate (chain end to end)', () => {
    const closing = buildShiftPartition({
      handoff: HANDOFF_40, checkpoint: null,
      fullDayCleaned: sentToFleet(LOG), offStandardEntries: [],
    }).closing;
    // 10 sent in the closing window / 8h — not 17/8 had raw gas leaked through.
    expect(computeShiftRates(closing).baseline).toBeCloseTo(10 / 8, 5);
  });
});

describe('applyShiftWindow excludes fleeting_sent from the window OTH', () => {
  const snapshot: ShiftSnapshot = { cleaned: 24, hours: 8, oth: 0 };
  const entries: OffStandardMinutes[] = [
    { startTime: '2026-06-05T17:00:00', minutes: 60, presetReason: 'fleeting_sent' }, // in window, EXEMPT
    { startTime: '2026-06-05T18:00:00', minutes: 30, presetReason: 'fleeting_cars' }, // in window, reduces
  ];

  it('only the non-sent fleeting time reduces the denominator', () => {
    const out = applyShiftWindow(snapshot, {
      date: '2026-06-05',
      actualStart: '16:00', actualEnd: '20:00',
      offStandardEntries: entries,
    });
    expect(out.oth).toBe(30); // 60 fleeting_sent minutes excluded

    // 4h clock, no break (span < 5h) → 4h; effort = 24 / (4 − 30/60) = 24 / 3.5
    const { yourEffort } = computeShiftRates(out);
    expect(yourEffort).toBeCloseTo(24 / 3.5, 5);
  });
});
