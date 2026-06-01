import { describe, it, expect } from 'vitest';
import {
  buildReHoldSubmission,
  reHoldPhotoBypassActive,
  canSubmitReHold,
  type ReHoldDraft,
} from '../../src/lib/reHoldDescription';

const draft = (over: Partial<ReHoldDraft> = {}): ReHoldDraft => ({
  holdType: 'damage',
  damageTypes: [],
  customDamage: '',
  description: '',
  notes: '',
  detailOdour: false,
  mechanicalPM: false,
  mechanicalSafetyRecall: false,
  noNewDamage: false,
  saleCarReturn: false,
  ...over,
});

describe('buildReHoldSubmission', () => {
  it('no-new-damage: default text, notes cleared', () => {
    expect(buildReHoldSubmission(draft({ noNewDamage: true })))
      .toEqual({ description: 'No new damage — returned to hold', notes: '' });
  });

  it('no-new-damage: folds notes into the description and clears the notes field', () => {
    expect(buildReHoldSubmission(draft({ noNewDamage: true, notes: 'left in lot B' })))
      .toEqual({ description: 'No new damage — left in lot B', notes: '' });
  });

  it('sale-car return: default text, notes cleared', () => {
    expect(buildReHoldSubmission(draft({ saleCarReturn: true })))
      .toEqual({ description: 'Sale car — returned from short-term circulation', notes: '' });
  });

  it('no-new-damage takes precedence over sale-car', () => {
    expect(buildReHoldSubmission(draft({ noNewDamage: true, saleCarReturn: true })).description)
      .toMatch(/^No new damage/);
  });

  it('damage: joins selected presets, preserves notes', () => {
    expect(buildReHoldSubmission(draft({ damageTypes: ['Dent', 'Scratch'], notes: 'rear left' })))
      .toEqual({ description: 'Dent, Scratch', notes: 'rear left' });
  });

  it('damage with "Other" + custom: swaps Other for the custom text', () => {
    expect(buildReHoldSubmission(draft({ damageTypes: ['Dent', 'Other'], customDamage: 'cracked trim' })).description)
      .toBe('Dent, cracked trim');
  });

  it('damage with "Other" but no custom text: keeps the literal Other', () => {
    expect(buildReHoldSubmission(draft({ damageTypes: ['Other'] })).description).toBe('Other');
  });

  it('detail + odour: prefixed when described, bare otherwise', () => {
    expect(buildReHoldSubmission(draft({ holdType: 'detail', detailOdour: true })).description).toBe('Odour/smoke/vape');
    expect(buildReHoldSubmission(draft({ holdType: 'detail', detailOdour: true, description: 'rear seats' })).description)
      .toBe('Odour/smoke/vape — rear seats');
  });

  it('mechanical + PM and + safety/recall', () => {
    expect(buildReHoldSubmission(draft({ holdType: 'mechanical', mechanicalPM: true })).description).toBe('PM due');
    expect(buildReHoldSubmission(draft({ holdType: 'mechanical', mechanicalSafetyRecall: true })).description)
      .toBe('Safety / recall — no visible defect');
  });

  it('free-text fallbacks for detail / mechanical with no toggle', () => {
    expect(buildReHoldSubmission(draft({ holdType: 'detail' })).description).toBe('Detail required');
    expect(buildReHoldSubmission(draft({ holdType: 'mechanical' })).description).toBe('Mechanical concern');
    expect(buildReHoldSubmission(draft({ holdType: 'detail', description: 'full detail' })).description).toBe('full detail');
  });
});

describe('reHoldPhotoBypassActive', () => {
  it('is true for each bypass condition and false by default', () => {
    expect(reHoldPhotoBypassActive(draft())).toBe(false);
    expect(reHoldPhotoBypassActive(draft({ holdType: 'detail', detailOdour: true }))).toBe(true);
    expect(reHoldPhotoBypassActive(draft({ holdType: 'mechanical', mechanicalPM: true }))).toBe(true);
    expect(reHoldPhotoBypassActive(draft({ holdType: 'mechanical', mechanicalSafetyRecall: true }))).toBe(true);
    expect(reHoldPhotoBypassActive(draft({ noNewDamage: true }))).toBe(true);
    expect(reHoldPhotoBypassActive(draft({ saleCarReturn: true }))).toBe(true);
  });

  it('detail-odour bypass only applies to the detail hold type', () => {
    expect(reHoldPhotoBypassActive(draft({ holdType: 'damage', detailOdour: true }))).toBe(false);
  });
});

describe('canSubmitReHold', () => {
  it('damage needs a selected type AND a photo (no bypass)', () => {
    expect(canSubmitReHold(draft(), { photoCount: 0, submitting: false })).toBe(false);
    expect(canSubmitReHold(draft({ damageTypes: ['Dent'] }), { photoCount: 0, submitting: false })).toBe(false);
    expect(canSubmitReHold(draft({ damageTypes: ['Dent'] }), { photoCount: 1, submitting: false })).toBe(true);
  });

  it('a bypass lifts both the type and photo requirements', () => {
    expect(canSubmitReHold(draft({ noNewDamage: true }), { photoCount: 0, submitting: false })).toBe(true);
  });

  it('submitting blocks regardless', () => {
    expect(canSubmitReHold(draft({ noNewDamage: true }), { photoCount: 0, submitting: true })).toBe(false);
  });
});
