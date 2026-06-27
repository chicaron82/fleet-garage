import { describe, it, expect } from 'vitest';
import { buildNavigateProposal, describeNavigate, NAV_DESTINATIONS } from './navProposal';

describe('buildNavigateProposal', () => {
  it('builds a labelled proposal for the flagship schedule-import', () => {
    expect(buildNavigateProposal('schedule-import')).toEqual({
      kind: 'navigate',
      destination: 'schedule-import',
      label: 'Schedule — Import from photo',
    });
  });

  it('every known destination builds + has a label', () => {
    for (const d of NAV_DESTINATIONS) {
      const p = buildNavigateProposal(d);
      expect(p?.destination).toBe(d);
      expect((p?.label ?? '').length).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown destination (ignored, never navigates blind)', () => {
    expect(buildNavigateProposal('fleet-master')).toBeNull();
    expect(buildNavigateProposal('')).toBeNull();
  });
});

describe('describeNavigate', () => {
  it('echoes the label', () => {
    expect(describeNavigate({ kind: 'navigate', destination: 'lost-found', label: 'Lost & Found' })).toBe(
      'offer to open Lost & Found',
    );
  });
});
