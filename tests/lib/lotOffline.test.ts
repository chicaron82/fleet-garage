import { describe, it, expect } from 'vitest';
import { lotOfflineState, registersWorker } from '../../src/lib/lotOffline';

describe('lotOfflineState', () => {
  it('a copy already here is "saved"; asked this visit is "saving"; otherwise "offer"', () => {
    expect(lotOfflineState(true, false)).toBe('saved');
    expect(lotOfflineState(false, true)).toBe('saving');
    expect(lotOfflineState(false, false)).toBe('offer');
  });
  it('⭐ only "offer" registers nothing: no download without a copy or a tap', () => {
    expect(registersWorker('offer')).toBe(false);
    expect(registersWorker('saving')).toBe(true);
    expect(registersWorker('saved')).toBe(true);
  });
});
