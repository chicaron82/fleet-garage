import { useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { QUICK_TAPS, type QuickTap } from './useOffStandardSession';
import { localDateStr } from './useFleetBalance';
import { orderQuickTaps, userShiftTypeOn, QUICK_START_VISIBLE } from '../lib/quickStartOrder';
import { loadQuickStartOrder, saveQuickStartOrder, clearQuickStartOrder } from '../lib/quickStartPrefs';
import type { ShiftType } from '../types';

interface ShiftLike { userId: string; date: string; shiftType: ShiftType }

/**
 * Owns the quick-start surface: the effective top-4 + collapsed remainder
 * (schedule-aware default or the user's saved order), the chevron expand state
 * (collapsed on each fresh mount — the top 4 should do the work most days), and
 * the customizer's drag/save/reset. localStorage init is a lazy useState read,
 * not an effect — userId is stable for the component's life.
 */
export function useQuickStart(userId: string, shifts: ShiftLike[]) {
  const [savedOrder, setSavedOrder] = useState<string[] | null>(() => loadQuickStartOrder(userId));
  const [expanded, setExpanded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);

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
    saveQuickStartOrder(userId, draftOrder);
    setSavedOrder(draftOrder);
    setCustomizing(false);
  };

  const resetCustomize = () => {
    clearQuickStartOrder(userId);
    setSavedOrder(null);
    setCustomizing(false);
  };

  return {
    topTaps, restTaps,
    expanded, toggleExpanded: () => setExpanded(e => !e),
    isCustomized: !!savedOrder && savedOrder.length > 0,
    customizing, openCustomize, closeCustomize: () => setCustomizing(false),
    draftOrder, draftTaps, handleDragEnd, saveCustomize, resetCustomize,
  };
}
