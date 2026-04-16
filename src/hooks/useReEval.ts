import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease, canVsaClear } from '../types';
import type { Hold, Vehicle, DetailReason, UserRole } from '../types';
import { USERS } from '../data/mock';

export type ReEvalAction = 'clear' | 're-hold' | 'escalate';

export interface ReEvalItem {
  hold: Hold;
  vehicle: Vehicle;
}

function getActions(detailReason: DetailReason, role: UserRole): ReEvalAction[] {
  if (detailReason === 'pet-hair') {
    return canRelease(role) ? ['clear', 're-hold'] : ['escalate'];
  }
  if (canVsaClear(detailReason)) {
    return ['clear', 're-hold'];
  }
  return [];
}

export function useReEval() {
  const { user } = useAuth();
  const { vehicles, holds, markReturned, markRepaired, addHold } = useGarage();
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ReEvalAction | 'confirm-return' | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const confirmReturn = async (holdId: string) => {
    setProcessing(true);
    await markReturned(holdId);
    setActiveHoldId(null);
    setActiveAction(null);
    setProcessing(false);
  };

  const clearHold = async (holdId: string) => {
    if (!user) return;
    setProcessing(true);
    await markRepaired(holdId, {
      holdId,
      repairedById: user.id,
      repairedAt: new Date().toISOString(),
      notes: notes.trim() || 'Cleared during re-evaluation — issue resolved',
    });
    setActiveHoldId(null);
    setActiveAction(null);
    setNotes('');
    setProcessing(false);
  };

  const reHoldVehicle = async (holdId: string) => {
    if (!user) return;
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    setProcessing(true);
    await addHold(
      hold.vehicleId,
      hold.damageDescription,
      notes.trim() || 'Re-hold from re-evaluation — issue persists',
      user.id,
      [],
      'detail',
      hold.detailReason,
      holdId,
    );
    setActiveHoldId(null);
    setActiveAction(null);
    setNotes('');
    setProcessing(false);
  };

  const getName = (userId: string) => USERS.find(u => u.id === userId)?.name ?? 'Unknown';

  return {
    items,
    count: items.length,
    getActions: (reason: DetailReason) => getActions(reason, user!.role),
    activeHoldId, setActiveHoldId,
    activeAction, setActiveAction,
    notes, setNotes,
    processing,
    confirmReturn,
    clearHold,
    reHoldVehicle,
    getName,
  };
}
