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
 * The effective preset order = a base order, with today's shift duty always
 * floated to the front on top of it:
 *
 * - **Base order:** a saved custom order from the customizer is used as-is
 *   (presets missing from it — e.g. one added in a later release — are appended
 *   so nothing silently disappears); with no saved order, the default array order.
 * - **Schedule-aware promotion (always on top):** on an opening/closing shift the
 *   rostered duty (Opening/Closing Duties) is floated to the FRONT of the base —
 *   even over a saved custom order, deduped so it leads exactly once. This is the
 *   point of the context feature: a customized user still gets today's duty
 *   leading, with their own favorites right behind it. Mid / day-off / not-
 *   rostered has no duty to float, so the base is returned untouched.
 */
export function orderQuickTaps(
  taps: QuickTap[],
  savedOrder: string[] | null,
  shiftType: ShiftType | null,
): QuickTap[] {
  // Base order: saved custom order (missing presets appended), else the default.
  let base: QuickTap[];
  if (savedOrder && savedOrder.length > 0) {
    const byId = new Map(taps.map(t => [t.id, t]));
    const ordered = savedOrder
      .map(id => byId.get(id))
      .filter((t): t is QuickTap => !!t);
    const seen = new Set(ordered.map(t => t.id));
    base = [...ordered, ...taps.filter(t => !seen.has(t.id))];
  } else {
    base = [...taps];
  }

  // Float today's rostered duty to the front, on top of whatever the base is.
  const promoteId = shiftType === 'opening' ? 'opening_duties'
    : shiftType === 'closing' ? 'closing_duties'
    : null;
  const promoted = promoteId ? base.find(t => t.id === promoteId) : undefined;
  if (!promoted) return base;
  return [promoted, ...base.filter(t => t.id !== promoted.id)];
}
