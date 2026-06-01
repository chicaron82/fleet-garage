import type { ReleaseType } from '../../types';

// Canned release reasons by type. EXCEPTION further splits by the hold being
// released (sale-car and detail holds get their own shorter lists).

const EXCEPTION_REASONS = [
  'Damage documented — vehicle serviceable for rental',
  'Awaiting parts — vehicle cleared for limited use',
  'Customer accepted known damage',
  'Repair appointment scheduled',
  'Insurance claim filed — vehicle cleared',
  'Management decision — operational need',
];

const PRE_EXISTING_REASONS = [
  'Known damage — vehicle cleared for regular rental',
  'Age-related wear — below repair threshold',
  'Minor cosmetic — no safety concern',
  'Repair cost exceeds vehicle value',
  'Management decision — accepted condition',
  'Insurance write-off pending — vehicle in use',
];

const DETAIL_EXCEPTION_REASONS = [
  'Vacuumed / cleaned in-house — cleared',
  'Contract closed — detail not pursued',
  'Acceptable for rental as-is',
  'Sent for professional detail',
];

const SALE_CAR_RELEASE_REASONS = [
  'Auction — short term circulation',
  'Released — auction not yet scheduled',
];

const MECHANICAL_RELEASE_REASONS = [
  'PM due — releasing short term, service within 2 days',
  'PM due — releasing short term, service within 1 week',
  'Low tread — short term, return before next rental cycle',
  'Minor mechanical — acceptable for short term use',
  'Fleet shortage — releasing pending next available service slot',
  'Management decision — operational need',
];

/** The reason list for a given release type and hold kind. */
export function reasonsFor(
  releaseType: ReleaseType,
  opts: { isSaleCarHold: boolean; isDetailHold: boolean },
): string[] {
  if (releaseType === 'MECHANICAL_RELEASE') return MECHANICAL_RELEASE_REASONS;
  if (releaseType === 'EXCEPTION') {
    return opts.isSaleCarHold ? SALE_CAR_RELEASE_REASONS
      : opts.isDetailHold ? DETAIL_EXCEPTION_REASONS
      : EXCEPTION_REASONS;
  }
  return PRE_EXISTING_REASONS;
}
