import { useState, type Dispatch, type SetStateAction } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import type { OffStandardEntry, OffStandardReason, OffStandardPresetReason, User, Hold, Vehicle } from '../types';
import { localDateStr } from './useFleetBalance';
import { useInProgressRecovery } from './useInProgressRecovery';
import { useOffStandardEDV } from './useOffStandardEDV';
import { deriveExplanation } from '../lib/offStandardReport';

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
      onSettled: () => setIsRecovering(false),
    },
    row => {
      setInProgressId(row.id as string);
      setStartTimestamp(row.start_time as string);
      setSelectedReason(row.reason as OffStandardReason);
      setExplanation((row.explanation as string | null) ?? '');
      if (row.preset_reason) edv.setSelectedPreset(row.preset_reason as OffStandardPresetReason);
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

  // Online twin of executeOfflineAction: attempt a live write (with session
  // refresh), falling back to the offline queue on a network error. Mirrors
  // the writeOrEnqueue pattern in useDriverLiveTrip, generalised to the two
  // tables this hook writes — off_standard_entries and the EDV-linked hold.
  const writeOrEnqueue = async (
    action: 'insert' | 'update' | 'delete',
    table: 'off_standard_entries' | 'holds',
    payload: Record<string, unknown>,
    eqField?: string,
    eqValue?: string,
  ): Promise<{ ok: boolean }> => {
    const enqueue = () => enqueueOfflineAction({ table, action, payload, eqField, eqValue });
    if (!navigator.onLine) { enqueue(); return { ok: true }; }
    const res = await writeWithRefresh(() => {
      // Runtime-dynamic table dispatch — bypass the typed client (see executeOfflineAction).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = (supabase as any).from(table);
      if (action === 'insert') return query.insert(payload);
      if (action === 'update') {
        const q = query.update(payload);
        return eqField && eqValue !== undefined ? q.eq(eqField, eqValue) : q;
      }
      const q = query.delete();
      return eqField && eqValue !== undefined ? q.eq(eqField, eqValue) : q;
    });
    if (!res.error) return { ok: true };
    const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
    if (isNetworkErr) { enqueue(); return { ok: true }; }
    return { ok: false };
  };

  // The EDV preset marks its linked hold as cleaned in-house. Same write on
  // every success path, so it lives here once.
  const linkEdvHold = (holdId: string) =>
    writeOrEnqueue('update', 'holds',
      { offstandard_linked: true, cleaned_inhouse_logged_at: new Date().toISOString() },
      'id', holdId);

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
      // EDV needs a hold lookup — run selectPreset (which sets edvNoMatch / linked hold),
      // then let the user review the result (auto-link card or no-match form) before starting.
      edv.selectPreset('edv');
      if (tap.defaultNote) setExplanation(tap.defaultNote);
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
    }, 'id', inProgressId!);

    if (!ok) {
      console.error('[handleEnd] update failed');
      setEndError(true);
      return;
    }

    if (selectedPreset === 'edv' && edvLinkedHoldId) await linkEdvHold(edvLinkedHoldId);

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
    selectPreset,
    saveNotes,
    handleStart,
    handleQuickTap,
    handleEnd,
    handleDiscard,
  };
}
