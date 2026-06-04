import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { convertToBackendFormat, convertFromBackend } from '../../lib/gas-sheet';
import { BackfillEntryForm, type BackfillFormState } from './BackfillEntryForm';
import type { WashbayLog, HandoffNote } from '../../types';

interface BackfillEntry {
  id: string;
  date: string;
  fullPages: number;
  lastPageEntries: number;
  carsRemaining: number;
  cleanNotPickedUp: number;
  teamSize: number;
  overtimeHours: number;
  enteredBy: string;
  enteredAt: string;
}

interface DayRow {
  date: string;
  label: string;
  primary: WashbayLog | null;
  backfill: BackfillEntry | null;
  handoff: HandoffNote | null;
}

interface Props {
  washbayLogs: WashbayLog[];
  handoffNotes: HandoffNote[];
}

const COMPANY_STANDARD = 3.0;

// Last backfill entry that has actual data — used to pre-fill the next one.
function findLatestBackfill(entries: BackfillEntry[]): BackfillEntry | null {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function buildRollingDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  return dates;
}

function fmtDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

function deriveStats(
  entry: { fullPages: number; lastPageEntries: number; carsRemaining: number; overtimeHours: number },
  isPeakSeason: boolean,
) {
  const carsIn      = entry.fullPages * 19 + entry.lastPageEntries;
  const carsCleaned = Math.max(0, carsIn - entry.carsRemaining);
  const baseHours   = isPeakSeason ? 16 : 15;
  const opHours     = baseHours + entry.overtimeHours;
  const throughput  = opHours > 0 ? carsCleaned / opHours : 0;
  return { carsIn, carsCleaned, opHours, throughput };
}

function deriveHandoffStats(note: HandoffNote) {
  const carsIn      = note.fullPages * 19 + note.lastPageEntries;
  const dateStr     = new Date(note.loggedAt).toLocaleDateString('en-CA');
  const shiftStart  = new Date(`${dateStr}T06:45:00`);
  const handoffHours = Math.max(0, (new Date(note.loggedAt).getTime() - shiftStart.getTime()) / 3_600_000);
  const partialRate  = handoffHours > 0 ? carsIn / handoffHours : 0;
  return { carsIn, handoffHours, partialRate };
}

// Blank form — pre-filled from the most recent backfill entry when available,
// so team size and OT don't need to be re-entered every time.
function blankForm(seed?: BackfillEntry | null): BackfillFormState {
  return {
    totalPages:           0,
    entriesOnCurrentPage: 0,
    carsRemaining:        '',
    cleanNotPickedUp:     '',
    teamSize:             seed?.teamSize ?? 3,
    overtimeHours:        seed?.overtimeHours ?? 0,
  };
}

export function WashbayHistorySection({ washbayLogs, handoffNotes }: Props) {
  const { user } = useAuth();
  const { isPeakSeason } = useSchedule();

  const [backfillEntries, setBackfillEntries] = useState<BackfillEntry[]>([]);
  const [openDate,  setOpenDate]  = useState<string | null>(null);
  const [form,      setForm]      = useState<BackfillFormState>(blankForm());
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('washbay_backfill_logs')
      .select('*')
      .eq('branch_id', user.branchId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setBackfillEntries((data as Record<string, unknown>[]).map(r => ({
          id:               r.id as string,
          date:             r.date as string,
          fullPages:        r.full_pages as number,
          lastPageEntries:  r.last_page_entries as number,
          carsRemaining:    r.cars_remaining as number,
          cleanNotPickedUp: r.clean_not_picked_up as number,
          teamSize:         r.team_size as number,
          overtimeHours:    (r.overtime_hours as number) ?? 0,
          enteredBy:        r.entered_by as string,
          enteredAt:        r.entered_at as string,
        })));
      });
  }, [user]);

  if (!user) return null;

  const dates = buildRollingDates();
  const rows: DayRow[] = dates.map(date => ({
    date,
    label:   fmtDateLabel(date),
    primary: washbayLogs.find(l => l.date.startsWith(date)) ?? null,
    backfill: backfillEntries.find(b => b.date.startsWith(date)) ?? null,
    handoff: handoffNotes.find(n =>
      new Date(n.loggedAt).toLocaleDateString('en-CA') === date,
    ) ?? null,
  }));

  const missingCount = rows.filter(r => !r.primary && !r.backfill).length;

  const handleOpen = (date: string, existing: BackfillEntry | null) => {
    setOpenDate(date);
    setSaveError('');
    if (existing) {
      // Edit mode — pre-fill from the existing record.
      const { totalPages, entriesOnCurrentPage } = convertFromBackend(
        existing.fullPages, existing.lastPageEntries,
      );
      setForm({
        totalPages,
        entriesOnCurrentPage,
        carsRemaining:    String(existing.carsRemaining),
        cleanNotPickedUp: String(existing.cleanNotPickedUp),
        teamSize:         existing.teamSize,
        overtimeHours:    existing.overtimeHours,
      });
    } else {
      // New entry — pre-fill team size + OT from the most recent backfill so
      // the VSA only has to change what's different from yesterday.
      setForm(blankForm(findLatestBackfill(backfillEntries)));
    }
  };

  const handleSave = async () => {
    if (!openDate || !user) return;
    setSaving(true);
    setSaveError('');

    const { fullPages, lastPageEntries } = convertToBackendFormat(
      form.totalPages, form.entriesOnCurrentPage,
    );

    const payload = {
      branch_id:           user.branchId,
      date:                openDate,
      full_pages:          fullPages,
      last_page_entries:   lastPageEntries,
      cars_remaining:      parseInt(String(form.carsRemaining)) || 0,
      clean_not_picked_up: parseInt(String(form.cleanNotPickedUp)) || 0,
      team_size:           form.teamSize,
      overtime_hours:      form.overtimeHours,
      entered_by:          user.id,
      entered_at:          new Date().toISOString(),
    };

    try {
      const existing = backfillEntries.find(b => b.date.startsWith(openDate));
      if (existing) {
        const { error } = await writeWithRefresh(() =>
          supabase.from('washbay_backfill_logs').update(payload).eq('id', existing.id),
        );
        if (error) throw error;
        setBackfillEntries(prev => prev.map(b => b.id === existing.id ? {
          ...b,
          fullPages, lastPageEntries,
          carsRemaining:    parseInt(String(form.carsRemaining)) || 0,
          cleanNotPickedUp: parseInt(String(form.cleanNotPickedUp)) || 0,
          teamSize:         form.teamSize,
          overtimeHours:    form.overtimeHours,
        } : b));
      } else {
        const { data, error } = await writeWithRefresh(() =>
          supabase.from('washbay_backfill_logs').insert(payload).select('id').single(),
        );
        if (error) throw error;
        setBackfillEntries(prev => [...prev, {
          id:               (data as { id: string }).id,
          date:             openDate,
          fullPages, lastPageEntries,
          carsRemaining:    parseInt(String(form.carsRemaining)) || 0,
          cleanNotPickedUp: parseInt(String(form.cleanNotPickedUp)) || 0,
          teamSize:         form.teamSize,
          overtimeHours:    form.overtimeHours,
          enteredBy:        user.id,
          enteredAt:        new Date().toISOString(),
        }]);
      }
      setOpenDate(null);
    } catch {
      setSaveError('Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Washbay Log History · Rolling 30 Days
          </h2>
          {missingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              {missingCount} missing
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{collapsed ? '▾' : '▴'}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(row => {
              const entry  = row.primary ?? row.backfill ?? null;
              const isOpen = openDate === row.date;
              const today  = new Date().toLocaleDateString('en-CA');
              if (row.date === today) return null;

              return (
                <div key={row.date}>
                  <div className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0">{row.label}</span>
                      {entry ? (() => {
                        const { carsCleaned, opHours, throughput } = deriveStats(entry, isPeakSeason);
                        const color = throughput >= COMPANY_STANDARD
                          ? 'text-green-600 dark:text-green-400'
                          : throughput >= 2.5 ? 'text-amber-500' : 'text-red-500 dark:text-red-400';
                        return (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{carsCleaned} cleaned</span>
                            <span className={`font-semibold ${color}`}>{throughput.toFixed(1)}/hr</span>
                            <span className="text-gray-400 dark:text-gray-500">{opHours}h window</span>
                            {row.backfill && !row.primary && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">backfill</span>
                            )}
                          </div>
                        );
                      })() : row.handoff ? (() => {
                        const { carsIn, handoffHours, partialRate } = deriveHandoffStats(row.handoff);
                        const color = partialRate >= COMPANY_STANDARD
                          ? 'text-green-600 dark:text-green-400'
                          : partialRate >= 2.5 ? 'text-amber-500' : 'text-red-500 dark:text-red-400';
                        const handoffTime = new Date(row.handoff.loggedAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{carsIn} cleaned</span>
                            <span className={`font-semibold ${color}`}>{partialRate.toFixed(1)}/hr</span>
                            <span className="text-gray-400 dark:text-gray-500">{handoffHours.toFixed(1)}h window</span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">⚠️ mid-shift · {handoffTime}</span>
                          </div>
                        );
                      })() : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">No data</span>
                      )}
                    </div>

                    {!row.primary && (
                      <button
                        type="button"
                        onClick={() => isOpen ? setOpenDate(null) : handleOpen(row.date, row.backfill)}
                        className="shrink-0 text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 transition cursor-pointer"
                      >
                        {isOpen ? 'Cancel' : row.backfill ? 'Edit' : 'Fill in'}
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <BackfillEntryForm
                      label={row.label}
                      form={form}
                      setForm={setForm}
                      saving={saving}
                      saveError={saveError}
                      onSave={handleSave}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
