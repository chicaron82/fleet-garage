import { describe, it, expect } from 'vitest';
import { creditState, formatUsd, isRunningLow, type LedgerRow } from '../../src/lib/effieCredit';

const topup = (at: string, amountUsd = 10): LedgerRow => ({ at, kind: 'topup', amountUsd });
const spend = (at: string, amountUsd: number): LedgerRow => ({ at, kind: 'spend', amountUsd });

describe('creditState', () => {
  it('subtracts spend since the top-up from the top-up amount', () => {
    const s = creditState([
      topup('2026-08-01T00:00:00Z', 10),
      spend('2026-08-02T00:00:00Z', 1.5),
      spend('2026-08-03T00:00:00Z', 0.75),
    ]);
    expect(s.spentSinceUsd).toBeCloseTo(2.25, 10);
    expect(s.remainingUsd).toBeCloseTo(7.75, 10);
    expect(s.fractionLeft).toBeCloseTo(0.775, 10);
  });

  it('IGNORES spend that predates the top-up — the previous load already paid for it', () => {
    const s = creditState([
      spend('2026-07-30T00:00:00Z', 9),   // last month's load, already spent
      topup('2026-08-01T00:00:00Z', 10),
      spend('2026-08-02T00:00:00Z', 1),
    ]);
    expect(s.spentSinceUsd).toBe(1);
    expect(s.remainingUsd).toBeCloseTo(9, 10);
  });

  it('measures against the LATEST top-up when he has loaded more than once', () => {
    const s = creditState([
      topup('2026-06-01T00:00:00Z', 10),
      spend('2026-06-15T00:00:00Z', 8),
      topup('2026-08-01T00:00:00Z', 20),   // a bigger load later
      spend('2026-08-05T00:00:00Z', 3),
    ]);
    expect(s.toppedUpAmount).toBe(20);
    expect(s.spentSinceUsd).toBe(3);
    expect(s.remainingUsd).toBeCloseTo(17, 10);
  });

  it('finds the latest top-up by TIMESTAMP, not row order', () => {
    // A caller fetching descending must get the same answer as one fetching ascending.
    const asc: LedgerRow[] = [topup('2026-06-01T00:00:00Z', 10), topup('2026-08-01T00:00:00Z', 20)];
    expect(creditState(asc).toppedUpAmount).toBe(20);
    expect(creditState([...asc].reverse()).toppedUpAmount).toBe(20);
  });

  it('counts a spend logged in the SAME instant as the top-up', () => {
    // `>=` — a call made the moment he taps the button must not fall through the crack.
    const at = '2026-08-01T00:00:00Z';
    expect(creditState([topup(at, 10), spend(at, 2)]).spentSinceUsd).toBe(2);
  });

  it('floors at zero — an overspent balance reads $0.00, never negative', () => {
    const s = creditState([topup('2026-08-01T00:00:00Z', 10), spend('2026-08-02T00:00:00Z', 12)]);
    expect(s.remainingUsd).toBe(0);
    expect(s.fractionLeft).toBe(0);
  });

  it('flags needsBaseline when no top-up has ever been recorded', () => {
    // Distinct from "$0 left": an un-started tracker must not look like an empty account.
    expect(creditState([]).needsBaseline).toBe(true);
    expect(creditState([spend('2026-08-01T00:00:00Z', 1)]).needsBaseline).toBe(true);
    expect(creditState([topup('2026-08-01T00:00:00Z', 10)]).needsBaseline).toBe(false);
  });

  it('survives a zero-dollar top-up without dividing by zero', () => {
    expect(creditState([topup('2026-08-01T00:00:00Z', 0)]).fractionLeft).toBe(0);
  });
});

describe('isRunningLow', () => {
  it('warns at or below a quarter left', () => {
    expect(isRunningLow(creditState([topup('2026-08-01T00:00:00Z', 10), spend('2026-08-02T00:00:00Z', 7.5)]))).toBe(true);
    expect(isRunningLow(creditState([topup('2026-08-01T00:00:00Z', 10), spend('2026-08-02T00:00:00Z', 7.4)]))).toBe(false);
  });

  it('does NOT warn when there is no baseline — nothing is known to be low', () => {
    expect(isRunningLow(creditState([]))).toBe(false);
  });
});

describe('formatUsd', () => {
  it('renders two decimals', () => {
    expect(formatUsd(7.756)).toBe('$7.76');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.004)).toBe('$0.00');
  });
});
