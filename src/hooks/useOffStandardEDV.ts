import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { hapticLight } from '../lib/haptics';
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
    selectPreset,
    resetEDV,
  };
}
