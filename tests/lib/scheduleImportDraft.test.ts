import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadImportDraft, saveImportDraft, clearImportDraft, isDraftFresh, draftHasWork,
  type ImportDraft,
} from '../../src/lib/scheduleImportDraft';
import type { ParsedSchedule } from '../../api/_lib/scheduleParse';

const sheet = { staff: [{ name: 'Vladimir', cells: [] }] } as unknown as ParsedSchedule;
const base = { image: 'data:image/jpeg;base64,AAA', schedule: sheet, degraded: false,
               nameOverrides: { 0: 'p-1' }, cellOverrides: { '0-2': 'closing' } } as Omit<ImportDraft, 'savedAt'>;

beforeEach(() => localStorage.clear());

describe('the in-progress import draft', () => {
  it('survives a round-trip — the whole reason it exists', () => {
    expect(saveImportDraft(base)).toBe('saved');
    const back = loadImportDraft()!;
    expect(back.nameOverrides).toEqual({ 0: 'p-1' });
    expect(back.cellOverrides).toEqual({ '0-2': 'closing' });
    expect(back.schedule).toEqual(sheet);
  });

  it('⭐ keeps the CORRECTIONS when the photo will not fit', () => {
    // The priority that decides this module: he is holding the paper and can re-shoot it in
    // seconds; the taps he already made are gone forever. So a quota failure drops the image,
    // never the work.
    const real = Storage.prototype.setItem;
    let first = true;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (first) { first = false; throw new Error('QuotaExceededError'); }
      real.call(this, k, v);
    });
    expect(saveImportDraft(base)).toBe('saved-without-image');
    spy.mockRestore();
    const back = loadImportDraft()!;
    expect(back.image).toBeNull();
    expect(back.cellOverrides).toEqual({ '0-2': 'closing' });   // the part that mattered
  });

  it('drops a draft whose week has long passed', () => {
    saveImportDraft(base, new Date('2026-01-01T00:00:00Z'));
    expect(loadImportDraft(new Date('2026-03-01T00:00:00Z'))).toBeNull();
    expect(localStorage.getItem('fg_schedule_import_draft')).toBeNull();  // and cleans up after itself
  });

  it('a 14-day-old draft is still fresh; 15 is not', () => {
    const d = (days: number): ImportDraft =>
      ({ ...base, savedAt: new Date(Date.UTC(2026, 7, 24 - days)).toISOString() });
    const now = new Date(Date.UTC(2026, 7, 24));
    expect(isDraftFresh(d(14), now)).toBe(true);
    expect(isDraftFresh(d(15), now)).toBe(false);
  });

  it('an untouched shell is not "work" — reopening would resume nothing', () => {
    expect(draftHasWork({ ...base, image: null, schedule: null, nameOverrides: {}, cellOverrides: {}, savedAt: 'x' })).toBe(false);
    // ...but a photo alone IS work: the parse may still have been in flight when he walked away.
    expect(draftHasWork({ ...base, schedule: null, nameOverrides: {}, cellOverrides: {}, savedAt: 'x' })).toBe(true);
  });

  it('corrupt storage reads as no draft rather than blocking the modal', () => {
    localStorage.setItem('fg_schedule_import_draft', '{not json');
    expect(loadImportDraft()).toBeNull();
  });

  it('clearing means gone — an explicit retake must not resurrect the old sheet', () => {
    saveImportDraft(base);
    clearImportDraft();
    expect(loadImportDraft()).toBeNull();
  });
});
