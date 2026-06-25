import { useEffect, useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { QUICK_TAPS, type QuickTap } from './useOffStandardSession';
import { localDateStr } from './useFleetBalance';
import { orderQuickTaps, userShiftTypeOn, QUICK_START_VISIBLE } from '../lib/quickStartOrder';
import { loadQuickStartOrder, fetchRemoteOrder, saveQuickStartOrder, clearQuickStartOrder } from '../lib/quickStartPrefs';
import type { ShiftType } from '../types';

interface ShiftLike { userId: string; date: string; shiftType: ShiftType }

/**
 * Owns the quick-start surface: the effective top-4 + collapsed remainder
 * (schedule-aware default or the user's saved order), the chevron expand state
 * (collapsed on each fresh mount — the top 4 should do the work most days), and
 * the customizer's drag/save/reset. The cache feeds a lazy useState read for an
 * instant first paint; an effect then pulls the authoritative order from the
 * profile and reconciles, so an arrangement saved on one device follows the user
 * to the next. userId is stable for the component's life.
 */
export function useQuickStart(userId: string, shifts: ShiftLike[]) {
  const [savedOrder, setSavedOrder] = useState<string[] | null>(() => loadQuickStartOrder(userId));
  const [expanded, setExpanded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);

  // Server is the source of truth: reconcile the cached order with the profile on
  // mount. On a fetch error (offline) keep the cached value rather than clobber it.
  useEffect(() => {
    let cancelled = false;
    fetchRemoteOrder(userId)
      .then(order => { if (!cancelled) setSavedOrder(order); })
      .catch(() => { /* offline — keep the cached order */ });
    return () => { cancelled = true; };
  }, [userId]);

  const shiftType = userShiftTypeOn(shifts, userId, localDateStr(0));

  const ordered = useMemo(
    () => orderQuickTaps(QUICK_TAPS, savedOrder, shiftType),
    [savedOrder, shiftType],
  );
  const topTaps = ordered.slice(0, QUICK_START_VISIBLE);
  const restTaps = ordered.slice(QUICK_START_VISIBLE);

  const draftTaps = useMemo(() => {
    const byId = new Map(QUICK_TAPS.map(t => [t.id, t] as const));
    return draftOrder.map(id => byId.get(id)).filter((t): t is QuickTap => !!t);
  }, [draftOrder]);

  const openCustomize = () => { setDraftOrder(ordered.map(t => t.id)); setCustomizing(true); };

  const handleDragEnd = (activeId: string, overId: string) => {
    if (activeId === overId) return;
    setDraftOrder(prev => {
      const from = prev.indexOf(activeId);
      const to = prev.indexOf(overId);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  const saveCustomize = () => {
    const order = draftOrder;
    setSavedOrder(order);          // optimistic — cache write inside is synchronous
    setCustomizing(false);
    void saveQuickStartOrder(userId, order).catch(() => { /* cached on-device; resyncs next save */ });
  };

  const resetCustomize = () => {
    setSavedOrder(null);
    setCustomizing(false);
    void clearQuickStartOrder(userId).catch(() => { /* cache cleared; profile resyncs next change */ });
  };

  return {
    topTaps, restTaps,
    expanded, toggleExpanded: () => setExpanded(e => !e),
    isCustomized: !!savedOrder && savedOrder.length > 0,
    customizing, openCustomize, closeCustomize: () => setCustomizing(false),
    draftOrder, draftTaps, handleDragEnd, saveCustomize, resetCustomize,
  };
}
