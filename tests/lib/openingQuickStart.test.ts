import { describe, it, expect } from 'vitest';
import { shouldShowOpeningQuickStart, dismissKeyFor } from '../../src/lib/openingQuickStart';

const base = { shiftType: 'opening' as const, working: true, logged: false, dismissed: false };

describe('shouldShowOpeningQuickStart', () => {
  it('shows on an opening shift he has not logged or dismissed', () => {
    expect(shouldShowOpeningQuickStart(base)).toBe(true);
  });

  // ⭐ The reported case: 18:26, shift long finished, duties logged — card still on screen.
  it('hides once the duties are logged — it must not ask twice', () => {
    expect(shouldShowOpeningQuickStart({ ...base, logged: true })).toBe(false);
  });

  // ⭐⭐ The case a logged-check ALONE would miss: the work happened, but not under his name, so
  // there is nothing in the database to detect. Only his tap can retire the card.
  it('hides when dismissed, even with nothing logged', () => {
    expect(shouldShowOpeningQuickStart({ ...base, dismissed: true })).toBe(false);
  });

  it('never shows off an opening shift, or on a day he is not working', () => {
    expect(shouldShowOpeningQuickStart({ ...base, shiftType: 'mid' })).toBe(false);
    expect(shouldShowOpeningQuickStart({ ...base, shiftType: 'closing' })).toBe(false);
    expect(shouldShowOpeningQuickStart({ ...base, shiftType: undefined })).toBe(false);
    expect(shouldShowOpeningQuickStart({ ...base, working: false })).toBe(false);
  });
});

describe('dismissKeyFor', () => {
  // ⚠️ A dateless key would silence the card permanently after one dismissal.
  it('scopes the dismissal to one day', () => {
    expect(dismissKeyFor('2026-08-26')).not.toBe(dismissKeyFor('2026-08-27'));
    expect(dismissKeyFor('2026-08-26')).toContain('2026-08-26');
  });
});
