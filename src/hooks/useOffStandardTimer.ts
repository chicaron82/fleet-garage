import { useState, useEffect, createElement, type ReactElement } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import type { OffStandardEntry, OffStandardReason, OffStandardPresetReason, User, Hold, Vehicle, ShiftWithUser } from '../types';
import { OFF_STANDARD_LABELS, OFF_STANDARD_PRESET_LABELS } from '../types';
import { pushNotification } from '../lib/garage-uploads';
import { localDateStr } from './useFleetBalance';
import { useInProgressRecovery } from './useInProgressRecovery';
import { useOffStandardEDV } from './useOffStandardEDV';
import {
  rowToOffStandard,
  deriveShiftLine,
  generateOffStandardReport,
  deriveExplanation,
  todayDateStr,
  fmtTime,
} from '../lib/offStandardReport';
import type { TripRow } from '../lib/offStandardReport';

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

interface UseOffStandardTimerProps {
  user: User;
  refreshTrigger?: number;
  holds: Hold[];
  vehicles: Vehicle[];
  shifts: ShiftWithUser[];
  resolveName: (id: string) => string;
}

export function useOffStandardTimer({
  user,
  refreshTrigger,
  holds,
  vehicles,
  shifts,
  resolveName,
}: UseOffStandardTimerProps) {
  const [isRecovering, setIsRecovering]     = useState(true);
  const [timerState, setTimerState]         = useState<TimerState>('idle');
  const [inProgressId, setInProgressId]     = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<OffStandardReason>('WFW');
  const [startTimestamp, setStartTimestamp] = useState<string>('');
  const [stopTimestamp, setStopTimestamp]   = useState<string>('');
  const [pendingMinutes, setPendingMinutes] = useState(0);
  const [explanation, setExplanation]       = useState('');
  const [copied, setCopied]                 = useState(false);
  const [pdfLoading, setPdfLoading]         = useState(false);
  const [startError, setStartError]         = useState(false);
  const [endError, setEndError]             = useState(false);
  const [entries, setEntries]               = useState<OffStandardEntry[]>([]);
  const [editingEntry, setEditingEntry]     = useState<OffStandardEntry | null>(null);

  // Preset + EDV state
  const edv = useOffStandardEDV({ holds, vehicles, resolveName });
  const { selectedPreset, edvLinkedHoldId, edvUnitNumber, edvManagerName, edvNoMatch, selectPreset } = edv;

  // Load completed entries for today
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    supabase
      .from('off_standard_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .gte('start_time', todayStart.toISOString())
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        if (data) setEntries((data as Record<string, unknown>[]).map(rowToOffStandard));
      });
  }, [user.id, refreshTrigger]);

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

  const handleSubmitBackdate = async (
    startTime: string,
    endTime:   string,
    reason:    OffStandardReason,
    notes:     string,
  ) => {
    const mins    = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
    const entryId = crypto.randomUUID();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').insert({
        id:             entryId,
        user_id:        user.id,
        branch_id:      user.branchId,
        date:           localDateStr(0),
        start_time:     startTime,
        stop_time:      endTime,
        minutes:        mins,
        reason,
        explanation:    notes || null,
        auto_from_trip: false,
        status:         'complete',
        is_backdated:   true,
        edit_status:    'pending',
      })
    );
    if (!error) {
      const label = OFF_STANDARD_LABELS[reason].short;
      await pushNotification(
        user.branchId,
        ['Branch Manager', 'Operations Manager'],
        '⏱️',
        `${user.name} submitted a backdated OTH entry — ${label} — ${fmtTime(startTime)}–${fmtTime(endTime)} — ${notes}`,
        'warning',
        { type: 'oth_backdate_request', entryId },
      );
      setEntries(prev => [...prev, {
        id:           entryId,
        startTime,
        stopTime:     endTime,
        minutes:      mins,
        reason,
        explanation:  notes || undefined,
        autoFromTrip: false,
        isBackdated:  true,
        editStatus:   'pending',
      }]);
    }
  };

  const handleSaveEdit = async (newEndTime: string, newMinutes: number, explanation: string) => {
    if (!editingEntry) return;
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        stop_time:        newEndTime,
        minutes:          newMinutes,
        explanation:      explanation || null,
        edit_status:      null,
        edited_end_time:  null,
        edit_requested_at: null,
        edit_requested_by: null,
        edit_staff_note:  null,
      }).eq('id', editingEntry.id)
    );
    if (!error) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id
        ? { ...e, stopTime: newEndTime, minutes: newMinutes, explanation: explanation || undefined, editStatus: null }
        : e
      ));
      setEditingEntry(null);
    }
  };

  const handleRequestEdit = async (newEndTime: string, newMinutes: number, editStaffNote: string, explanation: string) => {
    if (!editingEntry) return;
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        edited_end_time:  newEndTime,
        edit_requested_at: now,
        edit_requested_by: user.id,
        edit_status:      'pending',
        edit_staff_note:  editStaffNote || null,
        explanation:      explanation || null,
        edit_reviewed_by: null,
        edit_reviewed_at: null,
      }).eq('id', editingEntry.id)
    );
    if (!error) {
      const label = editingEntry.presetReason
        ? (OFF_STANDARD_PRESET_LABELS[editingEntry.presetReason] ?? OFF_STANDARD_LABELS[editingEntry.reason].short)
        : OFF_STANDARD_LABELS[editingEntry.reason].short;
      await pushNotification(
        user.branchId,
        ['Branch Manager', 'Operations Manager'],
        '⏱️',
        `${user.name} requested an OTH edit — ${label} — ${editingEntry.minutes}m → ${newMinutes}m`,
        'warning',
        { type: 'oth_edit_request', entryId: editingEntry.id },
      );
      setEntries(prev => prev.map(e => e.id === editingEntry.id
        ? { ...e, explanation: explanation || undefined, editStatus: 'pending', editedEndTime: newEndTime, editRequestedBy: user.id, editRequestedAt: now, editStaffNote: editStaffNote || undefined }
        : e
      ));
      setEditingEntry(null);
    }
  };

  const handleExport = async () => {
    hapticMedium();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: tripRows } = await supabase
      .from('vsa_trips')
      .select('depart_time, arrive_time, is_shuttle, reason')
      .eq('driver_id', user.id)
      .gte('depart_time', todayStart.toISOString())
      .not('arrive_time', 'is', null)
      .order('depart_time', { ascending: true });
    const shiftLine  = deriveShiftLine(shifts, user.id);
    const reportText = generateOffStandardReport(
      entries,
      (tripRows ?? []) as TripRow[],
      user,
      shiftLine,
    );
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Off-Standard Report — ${user.name} · ${todayDateStr()}`,
          text: reportText,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePDFExport = async () => {
    hapticMedium();
    setPdfLoading(true);
    try {
      const [{ pdf }, { OffStandardReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../components/off-standard/OffStandardReportPDF'),
      ]);

      const data = {
        userName:   user.name,
        employeeId: user.employeeId,
        dateLabel:  todayDateStr(),
        shiftLine:  deriveShiftLine(shifts, user.id),
        entries:    entries.map(e => ({
          startTime:    e.startTime,
          stopTime:     e.stopTime,
          minutes:      e.minutes,
          reason:       e.reason,
          explanation:  e.explanation,
          autoFromTrip: e.autoFromTrip,
        })),
      };

      // pdf() expects ReactElement<DocumentProps>; cast needed since createElement infers the component's own props
      const blob = await pdf(createElement(OffStandardReportPDF, { data }) as ReactElement<never>).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `oth-report-${user.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
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
    copied,
    startError,
    endError,
    entries,
    editingEntry,
    setEditingEntry,
    selectedPreset,
    edvLinkedHoldId,
    edvUnitNumber,
    edvManagerName,
    edvNoMatch,
    selectPreset,
    saveNotes,
    handleStart,
    handleQuickTap,
    handleEnd,
    handleDiscard,
    handleSubmitBackdate,
    handleSaveEdit,
    handleRequestEdit,
    handleExport,
    handlePDFExport,
    pdfLoading,
  };
}
