import { useState, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useGarage } from '../context/GarageContext';
import { useSchedule } from '../context/ScheduleContext';
import { supabase } from '../lib/supabase';
import type { OffStandardEntry, OffStandardReason, OffStandardPresetReason, OthEditStatus, ShiftType, ShiftWithUser, User } from '../types';
import { OFF_STANDARD_LABELS, OFF_STANDARD_PRESET_LABELS } from '../types';
import { pushNotification } from '../lib/garage-uploads';
import { OthEditSheet } from './OthEditSheet';
import { localDateStr } from '../hooks/useFleetBalance';
import { USERS } from '../data/mock';

const MIN_ENTRY_MINUTES = 5;

const REASONS: OffStandardReason[] = ['CLASS', 'WFW', 'MTG', 'WTH', 'OTH'];

interface QuickTap {
  label: string;
  reason: OffStandardReason;
  preset: OffStandardPresetReason | null;
  emoji: string;
}

const QUICK_TAPS: QuickTap[] = [
  { label: 'Opening Duties',       reason: 'OTH',   preset: 'opening_duties',   emoji: '🌅' },
  { label: 'Closing Duties',       reason: 'OTH',   preset: 'closing_duties',   emoji: '🌙' },
  { label: 'Fleeting Cars',        reason: 'OTH',   preset: 'fleeting_cars',    emoji: '🚗' },
  { label: 'Lot Organization',     reason: 'OTH',   preset: 'lot_organization', emoji: '🅿️' },
  { label: 'EDV',                  reason: 'OTH',   preset: 'edv',              emoji: '⚡' },
  { label: 'Customer Pickup/Drop', reason: 'OTH',   preset: 'customer_pickup',  emoji: '🤝' },
  { label: 'Waiting for Work',     reason: 'WFW',   preset: null,               emoji: '⏳' },
  { label: 'Training',             reason: 'CLASS', preset: null,               emoji: '📚' },
];

interface Props {
  user: User;
  refreshTrigger?: number;
}

function fmtMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function todayDateStr(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function rowToOffStandard(row: Record<string, unknown>): OffStandardEntry {
  return {
    id:              row.id as string,
    startTime:       row.start_time as string,
    stopTime:        row.stop_time as string,
    minutes:         row.minutes as number,
    reason:          row.reason as OffStandardReason,
    explanation:     (row.explanation as string | null) ?? undefined,
    autoFromTrip:    (row.auto_from_trip as boolean) ?? false,
    editedEndTime:   (row.edited_end_time as string | null) ?? undefined,
    editRequestedAt: (row.edit_requested_at as string | null) ?? undefined,
    editRequestedBy: (row.edit_requested_by as string | null) ?? undefined,
    editStatus:      (row.edit_status as OthEditStatus | null) ?? null,
    editReviewedBy:  (row.edit_reviewed_by as string | null) ?? undefined,
    editReviewedAt:  (row.edit_reviewed_at as string | null) ?? undefined,
    editStaffNote:   (row.edit_staff_note as string | null) ?? undefined,
  };
}

function shiftTypeLabel(shiftType: ShiftType): string {
  if (shiftType === 'day-off') return 'Day Off';
  if (shiftType === 'pto') return 'PTO';
  if (shiftType === 'sick') return 'Sick Day';
  return `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} shift`;
}

function deriveShiftLine(shifts: ShiftWithUser[], userId: string): string {
  const today = localDateStr(0);
  const todaysShifts = shifts.filter(s => s.userId === userId && s.date === today);
  if (todaysShifts.length === 0) return '8-hour shift';

  const withTimes = todaysShifts.find(s => s.startTime && s.endTime);
  const chosen = withTimes ?? todaysShifts[0];
  if (!chosen) return '8-hour shift';

  const label = shiftTypeLabel(chosen.shiftType);
  if (chosen.startTime && chosen.endTime) {
    return `${label} ${chosen.startTime}-${chosen.endTime}`;
  }
  return label;
}

interface TripRow { depart_time: string; arrive_time: string; is_shuttle: boolean | null; reason: string | null; }

function generateOffStandardReport(
  entries: OffStandardEntry[],
  trips: TripRow[],
  user: User,
  shiftLine: string,
): string {
  const offTotal = entries.reduce((s, e) => s + e.minutes, 0);

  const lines: string[] = [
    'OFF-STANDARD TIME REPORT',
    '─'.repeat(37),
    `Name:     ${user.name}`,
    `EEID:     ${user.employeeId}`,
    `Date:     ${todayDateStr()}`,
    `Shift:    ${shiftLine}`,
    '',
    'OFF-STANDARD ENTRIES',
    '─'.repeat(37),
  ];

  if (entries.length === 0) {
    lines.push('(none)');
  } else {
    for (const e of entries) {
      const auto = e.autoFromTrip ? '  [auto]' : '';
      const expl = e.explanation ? `  ${e.explanation}` : '';
      lines.push(`${fmtTime(e.startTime)} – ${fmtTime(e.stopTime)}  ${e.reason}${expl}${auto}`);
    }
  }

  lines.push('', `Total off-standard:  ${fmtMinutes(offTotal)}`);

  if (trips.length > 0) {
    lines.push('', 'AIRPORT TRIPS', '─'.repeat(37));
    for (const t of trips) {
      const mins = Math.round(
        (new Date(t.arrive_time).getTime() - new Date(t.depart_time).getTime()) / 60000
      );
      const label = t.is_shuttle ? 'Shuttle Transfer' : (t.reason ?? 'Airport Run');
      lines.push(`${fmtTime(t.depart_time)} – ${fmtTime(t.arrive_time)}  ${label}  (${mins}m)`);
    }
  }

  lines.push(
    '',
    'Manager approval: _________________',
    '─'.repeat(37),
    'Generated by Fleet Garage',
  );

  return lines.join('\n');
}

function deriveExplanation(
  preset: OffStandardPresetReason | null,
  unit: string,
  mgr: string,
  freeText: string,
): string {
  if (!preset) return freeText;
  if (preset === 'edv')              return unit ? `EDV — ${unit} — Released by ${mgr}` : 'EDV';
  if (preset === 'fleeting_cars')    return 'Fleeting cars';
  if (preset === 'closing_duties')   return 'Closing duties';
  if (preset === 'opening_duties')   return 'Opening duties';
  if (preset === 'lot_organization') return 'Lot organization';
  if (preset === 'customer_pickup')  return 'Customer pickup / drop-off';
  return '';
}

// ── Timer section ─────────────────────────────────────────────────────────────

type TimerState = 'idle' | 'running' | 'complete';

function ElapsedTicker({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="font-mono tabular-nums">{m}:{String(s).padStart(2, '0')}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function OffStandardTimeLog({ user, refreshTrigger }: Props) {
  const { holds, vehicles } = useGarage();
  const { shifts } = useSchedule();

  const [timerState, setTimerState]         = useState<TimerState>('idle');
  const [inProgressId, setInProgressId]     = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<OffStandardReason>('WFW');
  const [startTimestamp, setStartTimestamp] = useState<string>('');
  const [stopTimestamp, setStopTimestamp]   = useState<string>('');
  const [pendingMinutes, setPendingMinutes] = useState(0);
  const [explanation, setExplanation]       = useState('');
  const [copied, setCopied]                 = useState(false);
  const [startError, setStartError]         = useState(false);
  const [entries, setEntries]               = useState<OffStandardEntry[]>([]);
  const [editingEntry, setEditingEntry]     = useState<OffStandardEntry | null>(null);

  // Preset + EDV state
  const [selectedPreset, setSelectedPreset]     = useState<OffStandardPresetReason | null>(null);
  const [edvLinkedHoldId, setEdvLinkedHoldId]   = useState<string | null>(null);
  const [edvUnitNumber, setEdvUnitNumber]       = useState<string>('');
  const [edvManagerName, setEdvManagerName]     = useState<string>('');
  const [edvNoMatch, setEdvNoMatch]             = useState(false);

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
  useEffect(() => {
    supabase
      .from('off_standard_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const row = data as Record<string, unknown>;
        setInProgressId(row.id as string);
        setStartTimestamp(row.start_time as string);
        setSelectedReason(row.reason as OffStandardReason);
        setExplanation((row.explanation as string | null) ?? '');
        if (row.preset_reason) setSelectedPreset(row.preset_reason as OffStandardPresetReason);
        setTimerState('running');
      });
  }, [user.id]);

  // ── Preset helpers ────────────────────────────────────────────────────────

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
    const manager = USERS.find(u => u.id === edvHold.release?.approvedById);

    setEdvLinkedHoldId(edvHold.id);
    setEdvUnitNumber(vehicle?.unitNumber ?? edvHold.vehicleId);
    setEdvManagerName(manager?.name ?? edvHold.release?.approvedById ?? 'Unknown');
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  const saveNotes = async (val: string) => {
    if (!inProgressId) return;
    await supabase
      .from('off_standard_entries')
      .update({ explanation: val.trim() || null })
      .eq('id', inProgressId);
  };

  // ── Timer controls ────────────────────────────────────────────────────────

  // ─── WRITE-FIRST RULE (canonical reference) ──────────────────────────────────
  // Write confirmed before state update. This is the correct pattern.
  // Any feature that starts a session and needs to survive navigation
  // must follow this same pattern. See VSAMovementLog.handleStartTripWith.
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStartWith = async (
    reason: OffStandardReason,
    preset: OffStandardPresetReason | null,
    linkedHoldId: string | null = null,
  ) => {
    setStartError(false);
    const now  = new Date().toISOString();
    const expl = deriveExplanation(preset, edvUnitNumber, edvManagerName, explanation);
    if (preset) setExplanation(expl);

    const { data, error } = await supabase
      .from('off_standard_entries')
      .insert({
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
      })
      .select('id')
      .single();

    if (error) {
      console.error('Off-standard start write failed:', error);
      setStartError(true);
      return;
    }

    setInProgressId((data as { id: string }).id);
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
    setSelectedPreset(tap.preset);
    await handleStartWith(tap.reason, tap.preset);
  };

  const handleEnd = async () => {
    hapticLight();
    const now = new Date().toISOString();
    const mins = Math.round(
      (new Date(now).getTime() - new Date(startTimestamp).getTime()) / 60000
    );

    if (mins < MIN_ENTRY_MINUTES) {
      if (inProgressId) {
        await supabase.from('off_standard_entries').delete().eq('id', inProgressId);
      }
      handleDiscard();
      return;
    }

    const { error } = await supabase
      .from('off_standard_entries')
      .update({
        stop_time:   now,
        minutes:     mins,
        explanation: explanation.trim() || null,
        status:      'complete',
      })
      .eq('id', inProgressId!);

    if (!error) {
      if (selectedPreset === 'edv' && edvLinkedHoldId) {
        await supabase
          .from('holds')
          .update({ offstandard_linked: true, cleaned_inhouse_logged_at: new Date().toISOString() })
          .eq('id', edvLinkedHoldId);
      }
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
    }
  };

  const handleDiscard = () => {
    setTimerState('idle');
    setInProgressId(null);
    setStartTimestamp('');
    setStopTimestamp('');
    setPendingMinutes(0);
    setExplanation('');
    setSelectedPreset(null);
    setEdvLinkedHoldId(null);
    setEdvUnitNumber('');
    setEdvManagerName('');
    setEdvNoMatch(false);
    setStartError(false);
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const handleSaveEdit = async (newEndTime: string, newMinutes: number) => {
    if (!editingEntry) return;
    const { error } = await supabase.from('off_standard_entries').update({
      stop_time:        newEndTime,
      minutes:          newMinutes,
      edit_status:      null,
      edited_end_time:  null,
      edit_requested_at: null,
      edit_requested_by: null,
      edit_staff_note:  null,
    }).eq('id', editingEntry.id);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id
        ? { ...e, stopTime: newEndTime, minutes: newMinutes, editStatus: null }
        : e
      ));
      setEditingEntry(null);
    }
  };

  const handleRequestEdit = async (newEndTime: string, newMinutes: number, note: string) => {
    if (!editingEntry) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('off_standard_entries').update({
      edited_end_time:  newEndTime,
      edit_requested_at: now,
      edit_requested_by: user.id,
      edit_status:      'pending',
      edit_staff_note:  note || null,
      edit_reviewed_by: null,
      edit_reviewed_at: null,
    }).eq('id', editingEntry.id);
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
        ? { ...e, editStatus: 'pending', editedEndTime: newEndTime, editRequestedBy: user.id, editRequestedAt: now, editStaffNote: note || undefined }
        : e
      ));
      setEditingEntry(null);
    }
  };


  // ── Export ────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';

  return (
    <>
    <div className="space-y-5">

      {/* Quick Start */}
      {timerState === 'idle' && (
        <>
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              ⚡ Quick Start
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAPS.map(tap => (
                <button
                  key={tap.label}
                  type="button"
                  onClick={() => handleQuickTap(tap)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-yellow-400 dark:hover:border-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 active:scale-95 shadow-sm transition-all cursor-pointer"
                >
                  <span className="text-base">{tap.emoji}</span>
                  <span>{tap.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Start error — shown here so it's visible after a quick tap on mobile */}
          {startError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
            </div>
          )}
        </>
      )}

      {/* Timer card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Off-Standard Time</p>
        </div>
        <div className="p-4 space-y-4">

          {/* Reason pills — disabled while running or complete */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Reason</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  disabled={timerState !== 'idle'}
                  onClick={() => { if (timerState === 'idle') { hapticLight(); setSelectedReason(r); } }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:cursor-default ${
                    selectedReason === r
                      ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {r} · {OFF_STANDARD_LABELS[r].full}
                </button>
              ))}
            </div>
          </div>

          {/* Preset selector — visible when OTH selected and timer idle */}
          {selectedReason === 'OTH' && timerState === 'idle' && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Quick reason (optional)</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'fleeting_cars',   label: 'Fleeting Cars' },
                  { value: 'closing_duties',  label: 'Closing Duties' },
                  { value: 'opening_duties',  label: 'Opening Duties' },
                  { value: 'lot_organization', label: 'Lot Organization' },
                  { value: 'edv',             label: 'EDV' },
                  { value: 'customer_pickup', label: 'Customer Pickup/Drop-off' },
                ] as { value: OffStandardPresetReason; label: string }[]).map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => selectPreset(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      selectedPreset === p.value
                        ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* EDV auto-populate result */}
              {selectedPreset === 'edv' && !edvNoMatch && edvLinkedHoldId && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 text-xs space-y-0.5">
                  <p className="font-semibold text-teal-800 dark:text-teal-300">Hold matched</p>
                  <p className="text-teal-700 dark:text-teal-400">Unit: <span className="font-medium">{edvUnitNumber}</span></p>
                  <p className="text-teal-700 dark:text-teal-400">Released by: <span className="font-medium">{edvManagerName}</span></p>
                  <p className="text-teal-600 dark:text-teal-500 mt-1">💡 Typical EDV clean: 30–40 min</p>
                </div>
              )}

              {/* EDV no-match warning */}
              {selectedPreset === 'edv' && edvNoMatch && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
                  No released detail hold found for today. Log manually or check Holds for the unit.
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-blue-600 dark:text-blue-400">
            🔗 Airport trips log automatically from the Movement Log — no need to add them here.
          </p>

          {/* Start error */}
          {startError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
            </div>
          )}

          {/* idle → Start */}
          {timerState === 'idle' && (
            <button
              type="button"
              onClick={handleStart}
              className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold transition cursor-pointer"
            >
              Start
            </button>
          )}

          {/* running → elapsed + notes + End */}
          {timerState === 'running' && (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-4 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">
                  {selectedReason} · {OFF_STANDARD_LABELS[selectedReason].full}
                </p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  <ElapsedTicker startTime={startTimestamp} />
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                  Started {fmtTime(startTimestamp)}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="e.g. Waiting for dirties to arrive…"
                  className={INPUT}
                />
              </div>
              <button
                type="button"
                onClick={handleEnd}
                className="w-full py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer"
              >
                End
              </button>
            </div>
          )}

          {/* complete → saved card + notes still editable + Done */}
          {timerState === 'complete' && (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">✓ Entry saved</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {selectedReason} · {fmtTime(startTimestamp)} – {fmtTime(stopTimestamp)} · {fmtMinutes(pendingMinutes)}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="e.g. Waiting for dirties to arrive…"
                  className={INPUT}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleDiscard}
                className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Entries</p>
          {entries.map(entry => (
            <div
              key={entry.id}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                entry.autoFromTrip
                  ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {fmtTime(entry.startTime)} – {fmtTime(entry.stopTime)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {entry.reason}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {fmtMinutes(entry.minutes)}
                    </span>
                    {entry.autoFromTrip && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">🔗 From movement log</span>
                    )}
                    {entry.editStatus === 'pending' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pending approval</span>
                    )}
                  </div>
                  {entry.explanation && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{entry.explanation}</p>
                  )}
                  {entry.editStatus === 'denied' && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Edit denied — you may request again</p>
                  )}
                </div>
                {!entry.autoFromTrip && entry.editStatus !== 'pending' && (
                  <button
                    onClick={() => { hapticLight(); setEditingEntry(entry); }}
                    className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm cursor-pointer transition-colors"
                    aria-label="Edit entry"
                  >
                    ✏️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shift summary + export */}
      <button
        type="button"
        onClick={handleExport}
        className="w-full py-3 rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-semibold transition cursor-pointer"
      >
        {copied ? '✓ Copied to clipboard' : 'Export Off-Standard'}
      </button>

    </div>

    {editingEntry && (
      <OthEditSheet
        entry={editingEntry}
        onSave={handleSaveEdit}
        onRequest={handleRequestEdit}
        onClose={() => setEditingEntry(null)}
      />
    )}
    </>
  );
}
