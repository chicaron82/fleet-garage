import { describe, it, expect } from 'vitest';
import {
  buildLostItemProposal,
  describeLostItemProposal,
  normalizeLostItemLocation,
  lostItemLocationLabel,
  LOST_ITEM_LOCATIONS,
} from '../../../api/_lib/lostItemProposal';

describe('buildLostItemProposal', () => {
  it('trims + normalizes a full proposal', () => {
    expect(
      buildLostItemProposal({ description: '  black wallet ', location: 'back_seat', licensePlate: ' lur224 ', notes: ' front desk ' }),
    ).toEqual({ kind: 'lost_item', description: 'black wallet', location: 'back_seat', licensePlate: 'LUR224', notes: 'front desk' });
  });

  it('nulls blank optional fields and unknown locations', () => {
    const p = buildLostItemProposal({ description: 'umbrella', location: 'glovebox', licensePlate: '', notes: '' });
    expect(p.location).toBeNull();
    expect(p.licensePlate).toBeNull();
    expect(p.notes).toBeNull();
  });
});

describe('normalizeLostItemLocation', () => {
  it('coerces spaced/cased input to a known slot', () => {
    expect(normalizeLostItemLocation('Back Seat')).toBe('back_seat');
    expect(normalizeLostItemLocation('under seat')).toBe('under_seat');
  });

  it('returns null for unknown / empty', () => {
    expect(normalizeLostItemLocation('glovebox')).toBeNull();
    expect(normalizeLostItemLocation(undefined)).toBeNull();
  });

  it('every known slot round-trips and has a label', () => {
    for (const loc of LOST_ITEM_LOCATIONS) {
      expect(normalizeLostItemLocation(loc)).toBe(loc);
      expect(lostItemLocationLabel(loc).length).toBeGreaterThan(0);
    }
  });
});

describe('describeLostItemProposal', () => {
  it('includes the location label + plate', () => {
    expect(
      describeLostItemProposal(buildLostItemProposal({ description: 'black wallet', location: 'back_seat', licensePlate: 'LUR224' })),
    ).toBe('black wallet (Back seat) — plate LUR224');
  });

  it('is just the description when no extras', () => {
    expect(describeLostItemProposal(buildLostItemProposal({ description: 'umbrella' }))).toBe('umbrella');
  });
});
