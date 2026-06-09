import { describe, it, expect } from 'vitest';
import { lotStatusFromQueue } from '../../src/lib/closingQueue';

describe('lotStatusFromQueue', () => {
  it('is zeroed when the queue is empty', () => {
    expect(lotStatusFromQueue(0)).toBe('zeroed');
  });

  it('is a neutral non-zero filler when cars remain (no judgment — the count is what shows)', () => {
    expect(lotStatusFromQueue(1)).toBe('manageable');
    expect(lotStatusFromQueue(12)).toBe('manageable');
  });

  it('treats a negative/garbage count as zeroed', () => {
    expect(lotStatusFromQueue(-1)).toBe('zeroed');
  });
});
