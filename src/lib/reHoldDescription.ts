import type { HoldType } from '../types';

// Pure logic behind the re-hold "New Issue" form: how the various toggles and
// fields collapse into the persisted { description, notes }, plus the photo-bypass
// and submit-gating predicates. Kept out of the component so the branch matrix is
// unit-testable in isolation.

export interface ReHoldDraft {
  holdType: HoldType;
  damageTypes: string[];
  customDamage: string;
  /** Free-text description for detail / mechanical holds. */
  description: string;
  notes: string;
  detailOdour: boolean;
  mechanicalPM: boolean;
  mechanicalSafetyRecall: boolean;
  noNewDamage: boolean;
  saleCarReturn: boolean;
}

/** True when the situation legitimately has no photo to take (gates the photo requirement). */
export function reHoldPhotoBypassActive(d: ReHoldDraft): boolean {
  return (
    (d.holdType === 'detail' && d.detailOdour) ||
    (d.holdType === 'mechanical' && (d.mechanicalPM || d.mechanicalSafetyRecall)) ||
    d.noNewDamage ||
    d.saleCarReturn
  );
}

export function canSubmitReHold(d: ReHoldDraft, opts: { photoCount: number; submitting: boolean }): boolean {
  const bypass = reHoldPhotoBypassActive(d);
  const damageOk = d.holdType === 'damage' && !bypass ? d.damageTypes.length > 0 : true;
  return damageOk && (opts.photoCount > 0 || bypass) && !opts.submitting;
}

/** The { description, notes } to persist, mirroring the form's branch logic. */
export function buildReHoldSubmission(d: ReHoldDraft): { description: string; notes: string } {
  if (d.noNewDamage) {
    return {
      description: d.notes.trim() ? `No new damage — ${d.notes.trim()}` : 'No new damage — returned to hold',
      notes: '',
    };
  }
  if (d.saleCarReturn) {
    return {
      description: d.notes.trim() ? `Sale car — ${d.notes.trim()}` : 'Sale car — returned from short-term circulation',
      notes: '',
    };
  }

  let description: string;
  if (d.holdType === 'damage') {
    description =
      d.damageTypes.includes('Other') && d.customDamage.trim()
        ? [...d.damageTypes.filter(x => x !== 'Other'), d.customDamage.trim()].join(', ')
        : d.damageTypes.join(', ');
  } else if (d.holdType === 'detail' && d.detailOdour) {
    description = d.description.trim() ? `Odour/smoke/vape — ${d.description.trim()}` : 'Odour/smoke/vape';
  } else if (d.holdType === 'mechanical' && d.mechanicalPM) {
    description = d.description.trim() ? `PM due — ${d.description.trim()}` : 'PM due';
  } else if (d.holdType === 'mechanical' && d.mechanicalSafetyRecall) {
    description = d.description.trim() ? `Safety / recall — ${d.description.trim()}` : 'Safety / recall — no visible defect';
  } else {
    description = d.description.trim() || (d.holdType === 'detail' ? 'Detail required' : 'Mechanical hold');
  }

  return { description, notes: d.notes };
}
