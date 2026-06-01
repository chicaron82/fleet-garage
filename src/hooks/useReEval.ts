import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import type { Hold, Vehicle, DetailReason } from '../types';
import { getReEvalActions, type ReEvalAction } from '../lib/re-eval-actions';
import { useUserResolver } from './useUserResolver';

export type { ReEvalAction };

export interface ReEvalItem {
  hold: Hold;
  vehicle: Vehicle;
}

export function useReEval() {
  const { user } = useAuth();
  const { vehicles, holds, markReturned, markRepaired, addHold } = useVehicleHoldContext();
  const { getName } = useUserResolver();
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ReEvalAction | 'confirm-return' | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState(false);

  // Vehicles returned or still out from exception-released detail holds
  const items = useMemo<ReEvalItem[]>(() => {
    return holds
      .filter(h =>
        (h.status === 'RELEASED' || h.status === 'RETURNED') &&
        h.holdType === 'detail' &&
        h.detailReason &&
        h.release?.releaseType === 'EXCEPTION'
      )
      .map(h => ({
        hold: h,
        vehicle: vehicles.find(v => v.id === h.vehicleId)!,
      }))
      .filter(item =>
        item.vehicle &&
        (item.vehicle.status === 'OUT_ON_EXCEPTION' || item.vehicle.status === 'RETURNED')
      );
  }, [holds, vehicles]);

  // One guard for every re-eval write: spinner on, clear prior error, reset the
  // active card on success, surface an error (and always drop the spinner) on
  // failure. The vehicle-write ops throw on a failed primary write, so without
  // this the spinner would hang and the rejection would go unhandled.
  const runAction = async (fn: () => Promise<void>) => {
    setProcessing(true);
    setActionError(false);
    try {
      await fn();
      setActiveHoldId(null);
      setActiveAction(null);
      setNotes('');
    } catch {
      setActionError(true);
    } finally {
      setProcessing(false);
    }
  };

  const confirmReturn = (holdId: string) => runAction(() => markReturned(holdId));

  const clearHold = (holdId: string) => {
    if (!user) return;
    return runAction(() => markRepaired(holdId, {
      holdId,
      repairedById: user.id,
      repairedAt: new Date().toISOString(),
      notes: notes.trim() || 'Cleared during re-evaluation — issue resolved',
      outcome: 'clean',
    }));
  };

  const reHoldVehicle = (holdId: string) => {
    if (!user) return;
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    return runAction(() => addHold(
      hold.vehicleId,
      hold.damageDescription,
      notes.trim() || 'Re-hold from re-evaluation — issue persists',
      user.id,
      [],
      ['detail'],
      hold.detailReason,
      undefined,
      holdId,
    ));
  };

  return {
    items,
    count: items.length,
    getActions: (reason: DetailReason) => getReEvalActions(reason, user!.role),
    activeHoldId, setActiveHoldId,
    activeAction, setActiveAction,
    notes, setNotes,
    processing,
    actionError,
    confirmReturn,
    clearHold,
    reHoldVehicle,
    getName,
  };
}
