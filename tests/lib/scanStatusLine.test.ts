import { describe, it, expect } from 'vitest';
import { scanStatusLine, TONE_TEXT } from '../../src/lib/scanStatusLine';
import type { VehicleStatus } from '../../src/types';

describe('scanStatusLine', () => {
  it('⭐ a PRE-EXISTING car with a hold reads pre-existing, NOT "on hold"', () => {
    // Aaron's report: 0FA880, a Versa in circulation with an old scratch. The card said
    // "🔧 On hold (1)" in red — red means stop, and the car was fine to move. 59 cars were
    // in this state.
    const l = scanStatusLine('PRE_EXISTING', 1);
    expect(l.text).toMatch(/Pre-existing/);
    expect(l.text).not.toMatch(/On hold/);
    expect(l.tone).toBe('blue');
  });

  it('⭐ a SALE CAR with a hold stays a sale car — he flags those deliberately', () => {
    const l = scanStatusLine('SALE_CAR', 2);
    expect(l.text).toMatch(/Sale car \(2\)/);
    expect(l.tone).toBe('teal');
  });

  it('keeps the two states that were already right', () => {
    expect(scanStatusLine('OUT_ON_EXCEPTION', 1)).toEqual({ text: '⚠️ On exception (1)', tone: 'amber' });
    expect(scanStatusLine('HELD', 3)).toEqual({ text: '🔧 On hold (3)', tone: 'red' });
  });

  it('⭐ the hold count NEVER decides the wording — only ever adds a suffix', () => {
    // The inversion that was the bug: a hold RECORD and a HELD CAR are different things.
    for (const status of ['PRE_EXISTING', 'SALE_CAR', 'RETURNED', 'AUCTION_SHORT_TERM'] as VehicleStatus[]) {
      const withHold = scanStatusLine(status, 4);
      const without  = scanStatusLine(status, 0);
      expect(withHold.tone).toBe(without.tone);
      expect(withHold.text.replace(' (4)', '')).toBe(without.text);
    }
  });

  it('does not append a count to a CLEAR car — "Clear (1)" is nonsense', () => {
    // 4 clear cars carry a lingering released hold. The detail block still lists it.
    expect(scanStatusLine('CLEAR', 1)).toEqual({ text: '✅ Clear', tone: 'green' });
    expect(scanStatusLine('CLEAR', 0).text).toBe('✅ Clear');
  });

  it('⭐ EVERY vehicle status has a tone — a new one cannot fall through to red', () => {
    // The old three-branch line collapsed four statuses into a red "On hold". This is the guard
    // against that recurring when FG adds its next status.
    const all: VehicleStatus[] = ['HELD', 'OUT_ON_EXCEPTION', 'PRE_EXISTING', 'SALE_CAR', 'AUCTION_SHORT_TERM', 'RETURNED', 'CLEAR'];
    for (const s of all) {
      const l = scanStatusLine(s, 1);
      expect(TONE_TEXT[l.tone]).toBeTruthy();
      expect(l.text.length).toBeGreaterThan(2);
    }
    // Only the genuinely-stop states may be red or amber.
    expect(all.filter(s => scanStatusLine(s, 1).tone === 'red')).toEqual(['HELD']);
    expect(all.filter(s => scanStatusLine(s, 1).tone === 'amber')).toEqual(['OUT_ON_EXCEPTION']);
  });
});
