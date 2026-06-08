import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { hapticLight } from '../lib/haptics';
import { useVehicleByPlate } from './useVehicleByPlate';
import type { KnownPlate } from '../lib/vehicleByPlate';
import { localDateStr } from './useFleetBalance';
import { businessDateOf } from '../lib/shiftDay';
import type { Hold, Vehicle, OffStandardPresetReason } from '../types';

interface Props {
  holds: Hold[];
  vehicles: Vehicle[];
  resolveName: (id: string) => string;
}

export interface OffStandardEDVSlice {
  selectedPreset: OffStandardPresetReason | null;
  setSelectedPreset: Dispatch<SetStateAction<OffStandardPresetReason | null>>;
  edvLinkedHoldId: string | null;
  edvUnitNumber: string;
  edvManagerName: string;
  edvNoMatch: boolean;
  edvPlate: string;
  setEdvPlate: Dispatch<SetStateAction<string>>;
  edvExterior: boolean;
  setEdvExterior: Dispatch<SetStateAction<boolean>>;
  edvInterior: boolean;
  setEdvInterior: Dispatch<SetStateAction<boolean>>;
  edvPlateMatch: KnownPlate | null;
  rememberEdvPlate: () => void;
  restoreNoMatchEdv: (fields: { plate: string; exterior: boolean; interior: boolean }) => void;
  restoreLinkedEdv: (holdId: string) => void;
  selectPreset: (preset: OffStandardPresetReason) => void;
  resetEDV: () => void;
}

export function useOffStandardEDV({ holds, vehicles, resolveName }: Props): OffStandardEDVSlice {
  const [selectedPreset, setSelectedPreset] = useState<OffStandardPresetReason | null>(null);
  const [edvLinkedHoldId, setEdvLinkedHoldId] = useState<string | null>(null);
  const [edvUnitNumber, setEdvUnitNumber]     = useState<string>('');
  const [edvManagerName, setEdvManagerName]   = useState<string>('');
  const [edvNoMatch, setEdvNoMatch]           = useState(false);
  const [edvPlate,    setEdvPlate]    = useState('');
  const [edvExterior, setEdvExterior] = useState(false);
  const [edvInterior, setEdvInterior] = useState(false);
  const [edvPlateMatch, setEdvPlateMatch] = useState<KnownPlate | null>(null);
  const { resolve, remember } = useVehicleByPlate();

  // Recognize the typed no-match plate against the fleet + the cross-date registry
  // memory, so the field shows whose car it is instead of staying a blind text box.
  // Empty/short plates resolve to null without a query; the clear also goes through
  // the async path, so there's no synchronous setState in the effect body.
  useEffect(() => {
    const p = edvPlate.trim();
    let cancelled = false;
    const lookup = p.length >= 4 ? resolve(p) : Promise.resolve(null);
    lookup.then(m => { if (!cancelled) setEdvPlateMatch(m); });
    return () => { cancelled = true; };
  }, [edvPlate, resolve]);

  // Stage the no-match plate so it's recognized next time — best-effort, called
  // from the session's handleEnd once the entry has saved.
  const rememberEdvPlate = useCallback(() => {
    const p = edvPlate.trim();
    if (!p) return;
    void remember(p, edvPlateMatch?.vehicleId ? { vehicleId: edvPlateMatch.vehicleId } : {});
  }, [edvPlate, edvPlateMatch, remember]);

  function selectPreset(preset: OffStandardPresetReason) {
    hapticLight();
    const next = selectedPreset === preset ? null : preset;
    setSelectedPreset(next);
    setEdvLinkedHoldId(null);
    setEdvUnitNumber('');
    setEdvManagerName('');
    setEdvNoMatch(false);
    setEdvPlate('');
    setEdvExterior(false);
    setEdvInterior(false);
    setEdvPlateMatch(null);

    if (next !== 'edv') return;

    const today = localDateStr(0);
    const edvHold = holds.find(h =>
      h.holdTypes.includes('detail') &&
      h.status === 'RELEASED' &&
      (h.release ? businessDateOf(h.release.approvedAt) === today : false) &&
      !h.offstandardLinked
    );

    if (!edvHold) { setEdvNoMatch(true); return; }

    const vehicle = vehicles.find(v => v.id === edvHold.vehicleId);
    const approvedById = edvHold.release?.approvedById;

    setEdvLinkedHoldId(edvHold.id);
    setEdvUnitNumber(vehicle?.unitNumber ?? edvHold.vehicleId);
    setEdvManagerName(approvedById ? resolveName(approvedById) : 'Unknown');
  }

  function resetEDV() {
    setSelectedPreset(null);
    setEdvLinkedHoldId(null);
    setEdvUnitNumber('');
    setEdvManagerName('');
    setEdvNoMatch(false);
    setEdvPlate('');
    setEdvExterior(false);
    setEdvInterior(false);
    setEdvPlateMatch(null);
  }

  // Recovery restore — called by the session's in-progress recovery so a session
  // resumed after a navigate-away rebuilds its EDV context (the timer state alone
  // doesn't carry it). The no-match branch restores the manually-entered plate +
  // condition; the matched branch restores the linked hold (+ its display) so End
  // still marks it cleaned in-house.
  function restoreNoMatchEdv(fields: { plate: string; exterior: boolean; interior: boolean }) {
    setEdvNoMatch(true);
    setEdvPlate(fields.plate);
    setEdvExterior(fields.exterior);
    setEdvInterior(fields.interior);
  }

  function restoreLinkedEdv(holdId: string) {
    setEdvLinkedHoldId(holdId);
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    const vehicle = vehicles.find(v => v.id === hold.vehicleId);
    setEdvUnitNumber(vehicle?.unitNumber ?? hold.vehicleId);
    const approvedById = hold.release?.approvedById;
    setEdvManagerName(approvedById ? resolveName(approvedById) : 'Unknown');
  }

  return {
    selectedPreset,
    setSelectedPreset,
    edvLinkedHoldId,
    edvUnitNumber,
    edvManagerName,
    edvNoMatch,
    edvPlate,
    setEdvPlate,
    edvExterior,
    setEdvExterior,
    edvInterior,
    setEdvInterior,
    edvPlateMatch,
    rememberEdvPlate,
    restoreNoMatchEdv,
    restoreLinkedEdv,
    selectPreset,
    resetEDV,
  };
}
