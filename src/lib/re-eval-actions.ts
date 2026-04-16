import { canRelease, canVsaClear } from '../types';
import type { DetailReason, UserRole } from '../types';

export type ReEvalAction = 'clear' | 're-hold' | 'escalate';

/**
 * Tiered authorization for exception-return re-evaluation.
 *
 * Pet hair always escalates to management regardless of who's looking —
 * VSAs cannot clear it. Smoke/vape and too-dirty are VSA-clearable.
 *
 * Role-gating at this function is *not* a defense-in-depth check against
 * Drivers / external roles — the ReEvalPanel is already navigation-gated
 * upstream. This function assumes the caller has passed a role that can
 * reach the panel; its job is the within-panel action matrix.
 */
export function getReEvalActions(detailReason: DetailReason, role: UserRole): ReEvalAction[] {
  if (detailReason === 'pet-hair') {
    return canRelease(role) ? ['clear', 're-hold'] : ['escalate'];
  }
  if (canVsaClear(detailReason)) {
    return ['clear', 're-hold'];
  }
  return [];
}
