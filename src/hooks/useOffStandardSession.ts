import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import type { OffStandardEntry, OffStandardReason, OffStandardPresetReason, User, Hold, Vehicle } from '../types';
import { localDateStr } from './useFleetBalance';
import { useInProgressRecovery } from './useInProgressRecovery';
import { useOffStandardEDV } from './useOffStandardEDV';
import { deriveExplanation } from '../lib/offStandardReport';
import { writeOrEnqueue } from '../lib/offStandardWrite';

const MIN_ENTRY_MINUTES = 5;

export type TimerState = 'idle' | 'running' | 'complete';

export interface QuickTap {
  label: string;
  reason: OffStandardReason;
  preset: OffStandardPresetReason | null;
  emoji: string;
  defaultNote?: string;
}

export const QUICK_TAPS: QuickTap[] = [
  { label: 'Opening Duties',       reason: 'OTH',   preset: 'opening_duties',   emoji: '🌅' },
  { label: 'Closing Duties',       reason: 'OTH',   preset: 'closing_duties',   emoji: '🌙' },
  { label: 'Fleeting Cars',        reason: 'OTH',   preset: 'fleeting_cars',    emoji: '🚗' },
  { label: 'Lot Organization',     reason: 'OTH',   preset: 'lot_organization', emoji: '🅿️' },
  { label: 'EDV',                  reason: 'OTH',   preset: 'edv',              emoji: '⚡' },
  { label: 'Pickup/Drop',          reason: 'OTH',   preset: 'customer_pickup',  emoji: '🤝' },
  { label: 'Flipping Returns',     reason: 'OTH',   preset: 'airport_flip',     emoji: '🔄' },
  { label: 'Waiting for Work',     reason: 'WFW',   preset: null,               emoji: '⏳' },
  { label: 'Training',             reason: 'CLASS', preset: null,               emoji: '📚' },
];

interface UseOffStandardSessionProps {
  user: User;
  holds: Hold[];
  vehicles: Vehicle[];
  resolveName: (id: string) => string;
  /** The completed-entries list is owned by the parent; the session appends to it on End. */
  setEntries: Dispatch<SetStateAction<OffStandardEntry[]>>;
}

/**
 * The live off-standard timer: start (manual or quick-tap), end, discard, and
 * unmount-recovery. Owns the running-session state and the write-with-offline-
 * fallback path; completed entries are pushed up to the parent via setEntries.
 */
export function useOffStandardSession({
  user,
  holds,
  vehicles,
  resolveName,
  setEntries,
}: UseOffStandardSessionProps) {
  const [isRecovering, setIsRecovering]     = useState(true);
  const [timerState, setTimerState]         = useState<TimerState>('idle');
  const [inProgressId, setInProgressId]     = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<OffStandardReason>('WFW');
  const [startTimestamp, setStartTimestamp] = useState<string>('');
  const [stopTimestamp, setStopTimestamp]   = useState<string>('');
  const [pendingMinutes, setPendingMinutes] = useState(0);
  const [explanation, setExplanation]       = useState('');
  const [startError, setStartError]         = useState(false);
  const [endError, setEndError]             = useState(false);

  const edv = useOffStandardEDV({ holds, vehicles, resolveName });
  const { selectedPreset, edvLinkedHoldId, edvUnitNumber, edvManagerName, edvNoMatch, selectPreset,
          edvPlate, edvExterior, edvInterior } = edv;

  // Recovery: restore any in_progress entry on mount
  useInProgressRecovery(
    {
      table: 'off_standard_entries',
      userField: 'user_id',
      userId: user.id,
      orderBy: 'start_time',
      onSettled: () => setIsRecovering(false),
    },
    row => {
      setInProgressId(row.id as string);
      setStartTimestamp(row.start_time as string);
      setSelectedReason(row.reason as OffStandardReason);
      setExplanation((row.explanation as string | null) ?? '');
      if (row.preset_reason) edv.setSelectedPreset(row.preset_reason as OffStandardPresetReason);
      // The timer state alone doesn't carry the EDV context — rebuild it from the
      // row so a navigate-away mid-session doesn't lose the manually-entered plate
      // + condition (no-match) or the linked hold (matched). Both are needed at End.
      if (row.preset_reason === 'edv') {
        if (row.linked_hold_id) {
          edv.restoreLinkedEdv(row.linked_hold_id as string);
        } else {
          edv.restoreNoMatchEdv({
            plate:    (row.edv_plate as string | null) ?? '',
            exterior: !!row.edv_exterior,
            interior: !!row.edv_interior,
          });
        }
      }
      setTimerState('running');
    },
  );

  const saveNotes = async (val: string) => {
    if (!inProgressId) return;
    await supabase
      .from('off_standard_entries')
      .update({ explanation: val.trim() || null })
      .eq('id', inProgressId);
  };

  // The EDV preset marks its linked hold as cleaned in-house. Same write on
  // every success path, so it lives here once.
  const linkEdvHold = (holdId: string) =>
    writeOrEnqueue('update', 'holds',
      { offstandard_linked: true, cleaned_inhouse_logged_at: new Date().toISOString() },
      'id', holdId);

  // Write-through: persist EDV no-match fields to the in-progress row as they're
  // entered (they're typed after start, so the start INSERT can't carry them).
  // Each change is written immediately so the latest survives a navigate-away —
  // the recovery above restores it on the next mount. Matched EDV needs none of
  // this; its linked hold is already written at start.
  useEffect(() => {
    if (timerState !== 'running' || selectedPreset !== 'edv' || !edvNoMatch || !inProgressId) return;
    void writeOrEnqueue('update', 'off_standard_entries', {
      edv_plate:    edvPlate.trim() || null,
      edv_exterior: edvExterior,
      edv_interior: edvInterior,
    }, 'id', inProgressId);
  }, [edvPlate, edvExterior, edvInterior, timerState, selectedPreset, edvNoMatch, inProgressId]);

  const handleStartWith = async (
    reason: OffStandardReason,
    preset: OffStandardPresetReason | null,
    linkedHoldId: string | null = null,
  ) => {
    setStartError(false);
    const now  = new Date().toISOString();
    const expl = deriveExplanation(preset, edvUnitNumber, explanation);
    if (preset) setExplanation(expl);

    const entryId = crypto.randomUUID();
    const { ok } = await writeOrEnqueue('insert', 'off_standard_entries', {
      id:             entryId,
      user_id:        user.id,
      branch_id:      user.branchId,
      date:           localDateStr(0),
      start_time:     now,
      stop_time:      null,
      minutes:        null,
      reason,
      explanation:    expl.trim() || null,
      auto_from_trip: false,
      status:         'in_progress',
      ...(preset ? { preset_reason: preset } : {}),
      ...(preset === 'edv' && linkedHoldId ? { linked_hold_id: linkedHoldId } : {}),
      ...(preset === 'edv' && edvNoMatch ? {
        edv_plate:    edvPlate.trim() || null,
        edv_exterior: edvExterior,
        edv_interior: edvInterior,
      } : {}),
    });

    if (!ok) {
      console.error('Off-standard start write failed');
      setStartError(true);
      return;
    }

    setInProgressId(entryId);
    setStartTimestamp(now);
    setTimerState('running');
  };

  const handleStart = async () => {
    hapticLight();
    await handleStartWith(selectedReason, selectedPreset, edvLinkedHoldId);
  };

  const handleQuickTap = async (tap: QuickTap) => {
    if (timerState !== 'idle') return;
    hapticMedium();
    setSelectedReason(tap.reason);
    if (tap.preset === 'edv') {
      // Run the hold lookup (sets edvNoMatch / edvLinkedHoldId via state) then start
      // immediately. edvNoMatch state is batched — INSERT won't carry EDV cols, but
      // handleEnd's UPDATE will persist whatever the user fills in while running.
      edv.selectPreset('edv');
      if (tap.defaultNote) setExplanation(tap.defaultNote);
      await handleStartWith(tap.reason, tap.preset);
      return;
    }
    edv.setSelectedPreset(tap.preset);
    if (tap.defaultNote) setExplanation(tap.defaultNote);
    await handleStartWith(tap.reason, tap.preset);
  };

  const handleEnd = async () => {
    hapticLight();
    setEndError(false);
    const now = new Date().toISOString();
    const mins = Math.round(
      (new Date(now).getTime() - new Date(startTimestamp).getTime()) / 60000
    );

    // Discard sub-threshold entries entirely rather than logging them.
    if (mins < MIN_ENTRY_MINUTES) {
      if (inProgressId) await writeOrEnqueue('delete', 'off_standard_entries', {}, 'id', inProgressId);
      handleDiscard();
      return;
    }

    const { ok } = await writeOrEnqueue('update', 'off_standard_entries', {
      stop_time:   now,
      minutes:     mins,
      explanation: explanation.trim() || null,
      status:      'complete',
      ...(selectedPreset === 'edv' && edvNoMatch ? {
        edv_plate:    edvPlate.trim() || null,
        edv_exterior: edvExterior,
        edv_interior: edvInterior,
      } : {}),
    }, 'id', inProgressId!);

    if (!ok) {
      console.error('[handleEnd] update failed');
      setEndError(true);
      return;
    }

    if (selectedPreset === 'edv' && edvLinkedHoldId) await linkEdvHold(edvLinkedHoldId);
    // Stage a manually-entered EDV plate so it's recognized next time (best-effort).
    if (selectedPreset === 'edv' && edvNoMatch && edvPlate.trim()) edv.rememberEdvPlate();

    setStopTimestamp(now);
    setPendingMinutes(mins);
    setEntries(prev => [...prev, {
      id:           inProgressId!,
      startTime:    startTimestamp,
      stopTime:     now,
      minutes:      mins,
      reason:       selectedReason,
      explanation:  explanation.trim() || undefined,
      autoFromTrip: false,
      presetReason: selectedPreset,
      linkedHoldId: selectedPreset === 'edv' ? edvLinkedHoldId : null,
      ...(selectedPreset === 'edv' && edvNoMatch ? {
        edvPlate:    edvPlate.trim() || undefined,
        edvExterior,
        edvInterior,
      } : {}),
    }]);
    setTimerState('complete');
  };

  const handleDiscard = () => {
    setTimerState('idle');
    setInProgressId(null);
    setStartTimestamp('');
    setStopTimestamp('');
    setPendingMinutes(0);
    setExplanation('');
    edv.resetEDV();
    setStartError(false);
    setEndError(false);
  };

  return {
    isRecovering,
    timerState,
    inProgressId,
    selectedReason,
    setSelectedReason,
    startTimestamp,
    stopTimestamp,
    pendingMinutes,
    explanation,
    setExplanation,
    startError,
    endError,
    selectedPreset,
    edvLinkedHoldId,
    edvUnitNumber,
    edvManagerName,
    edvNoMatch,
    edvPlate,
    setEdvPlate: edv.setEdvPlate,
    edvExterior,
    setEdvExterior: edv.setEdvExterior,
    edvInterior,
    setEdvInterior: edv.setEdvInterior,
    edvPlateMatch: edv.edvPlateMatch,
    selectPreset,
    saveNotes,
    handleStart,
    handleQuickTap,
    handleEnd,
    handleDiscard,
  };
}
