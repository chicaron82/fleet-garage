import type { QuickTap } from '../hooks/useOffStandardSession';
import type { ShiftType } from '../types';

/** How many quick-start presets show before the chevron collapse. */
export const QUICK_START_VISIBLE = 4;

/** The current user's shift type for a given date, or null if not rostered that day. */
export function userShiftTypeOn(
  shifts: { userId: string; date: string; shiftType: ShiftType }[],
  userId: string,
  date: string,
): ShiftType | null {
  return shifts.find(s => s.userId === userId && s.date === date)?.shiftType ?? null;
}

/**
 * The effective preset order, by the two-tier priority:
 *
 * - **Tier 2 (personal override):** a saved custom order from the customizer wins
 *   outright. Presets not in the saved order (e.g. one added in a later release)
 *   are appended so nothing silently disappears.
 * - **Tier 1 (schedule-aware default):** with no saved order, the default array
 *   order, with the rostered duty promoted to the front — an opening shift
 *   surfaces Opening Duties, a closing shift surfaces Closing Duties. Any other
 *   shift type (mid / day-off / none) leaves the default order untouched.
 */
export function orderQuickTaps(
  taps: QuickTap[],
  savedOrder: string[] | null,
  shiftType: ShiftType | null,
): QuickTap[] {
  if (savedOrder && savedOrder.length > 0) {
    const byId = new Map(taps.map(t => [t.id, t]));
    const ordered = savedOrder
      .map(id => byId.get(id))
      .filter((t): t is QuickTap => !!t);
    const seen = new Set(ordered.map(t => t.id));
    return [...ordered, ...taps.filter(t => !seen.has(t.id))];
  }

  const promoteId = shiftType === 'opening' ? 'opening_duties'
    : shiftType === 'closing' ? 'closing_duties'
    : null;
  const promoted = promoteId ? taps.find(t => t.id === promoteId) : undefined;
  if (!promoted) return [...taps];
  return [promoted, ...taps.filter(t => t.id !== promoted.id)];
}
