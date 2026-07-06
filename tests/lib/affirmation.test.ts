import { describe, it, expect } from 'vitest';
import { isAffirmation } from '../../src/lib/affirmation';

describe('isAffirmation', () => {
  it('accepts bare confirmations (case/punctuation/spacing tolerant)', () => {
    for (const s of ['confirm', 'Confirm.', 'YES', 'yes please', 'do it', 'Do  it!', 'add it', 'go ahead']) {
      expect(isAffirmation(s)).toBe(true);
    }
  });

  it('rejects a QUALIFIED yes — those must go to Effie, not fire a confirm', () => {
    for (const s of ['yes but change the colour', 'confirm the blue one', 'add it as damaged', 'yes it went to FastAir']) {
      expect(isAffirmation(s)).toBe(false);
    }
  });

  it('rejects negatives and unrelated text', () => {
    for (const s of ['no', 'cancel', 'wait', "what's held?", '', '   ']) {
      expect(isAffirmation(s)).toBe(false);
    }
  });
});
