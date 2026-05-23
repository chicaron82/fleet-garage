import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { hapticLight } from '../lib/haptics';
import { localDateStr } from './useFleetBalance';
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
  selectPreset: (preset: OffStandardPresetReason) => void;
  resetEDV: () => void;
}

export function useOffStandardEDV({ holds, vehicles, resolveName }: Props): OffStandardEDVSlice {
  const [selectedPreset, setSelectedPreset] = useState<OffStandardPresetReason | null>(null);
  const [edvLinkedHoldId, setEdvLinkedHoldId] = useState<string | null>(null);
  const [edvUnitNumber, setEdvUnitNumber]     = useState<string>('');
  const [edvManagerName, setEdvManagerName]   = useState<string>('');
  const [edvNoMatch, setEdvNoMatch]           = useState(false);

  function selectPreset(preset: OffStandardPresetReason) {
    hapticLight();
    const next = selectedPreset === preset ? null : preset;
    setSelectedPreset(next);
    setEdvLinkedHoldId(null);
    setEdvUnitNumber('');
    setEdvManagerName('');
    setEdvNoMatch(false);

    if (next !== 'edv') return;

    const today = localDateStr(0);
    const edvHold = holds.find(h =>
      h.holdTypes.includes('detail') &&
      h.status === 'RELEASED' &&
      h.release?.approvedAt.startsWith(today) &&
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
  }

  return {
    selectedPreset,
    setSelectedPreset,
    edvLinkedHoldId,
    edvUnitNumber,
    edvManagerName,
    edvNoMatch,
    selectPreset,
    resetEDV,
  };
}
