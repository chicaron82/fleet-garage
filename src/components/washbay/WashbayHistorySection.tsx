import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
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
  date: string;           // ISO "2026-05-07"
  label: string;          // "Wed May 7"
  primary: WashbayLog | null;
  backfill: BackfillEntry | null;
  handoff: HandoffNote | null;
}

interface Props {
  washbayLogs: WashbayLog[];
  handoffNotes: HandoffNote[];
}

const COMPANY_STANDARD = 3.0;

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

function deriveStats(entry: { fullPages: number; lastPageEntries: number; carsRemaining: number; overtimeHours: number }, isPeakSeason: boolean) {
  const carsIn      = entry.fullPages * 19 + entry.lastPageEntries;
  const carsCleaned = Math.max(0, carsIn - entry.carsRemaining);
  const baseHours   = isPeakSeason ? 16 : 15;
  const opHours     = baseHours + entry.overtimeHours;
  const throughput  = opHours > 0 ? carsCleaned / opHours : 0;
  return { carsIn, carsCleaned, opHours, throughput };
}

function deriveHandoffStats(note: HandoffNote) {
  const carsIn = note.fullPages * 19 + note.lastPageEntries;
  const dateStr = new Date(note.loggedAt).toLocaleDateString('en-CA');
  const shiftStart = new Date(`${dateStr}T06:45:00`);
  const handoffHours = Math.max(0, (new Date(note.loggedAt).getTime() - shiftStart.getTime()) / 3_600_000);
  const partialRate = handoffHours > 0 ? carsIn / handoffHours : 0;
  return { carsIn, handoffHours, partialRate };
}

const BLANK_FORM = { fullPages: 0, lastPageEntries: 0, carsRemaining: '', cleanNotPickedUp: '', teamSize: 3, overtimeHours: 0 };

export function WashbayHistorySection({ washbayLogs, handoffNotes }: Props) {
  const { user } = useAuth();
  const { isPeakSeason } = useSchedule();

  const [backfillEntries, setBackfillEntries] = useState<BackfillEntry[]>([]);
  const [openDate, setOpenDate]               = useState<string | null>(null);
  const [form, setForm]                       = useState(BLANK_FORM);
  const [saving, setSaving]                   = useState(false);
  const [collapsed, setCollapsed]             = useState(true);

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
    label:    fmtDateLabel(date),
    primary:  washbayLogs.find(l => l.date.startsWith(date)) ?? null,
    backfill: backfillEntries.find(b => b.date.startsWith(date)) ?? null,
    // Latest handoff for this date — first match since handoffNotes are DESC by loggedAt
    handoff:  handoffNotes.find(n =>
      new Date(n.loggedAt).toLocaleDateString('en-CA') === date
    ) ?? null,
  }));

  const missingCount = rows.filter(r => !r.primary && !r.backfill).length;

  const handleOpen = (date: string, existing: BackfillEntry | null) => {
    setOpenDate(date);
    setForm(existing ? {
      fullPages:        existing.fullPages,
      lastPageEntries:  existing.lastPageEntries,
      carsRemaining:    String(existing.carsRemaining),
      cleanNotPickedUp: String(existing.cleanNotPickedUp),
      teamSize:         existing.teamSize,
      overtimeHours:    existing.overtimeHours,
    } : BLANK_FORM);
  };

  const handleSave = async () => {
    if (!openDate || !user) return;
    setSaving(true);

    const payload = {
      branch_id:            user.branchId,
      date:                 openDate,
      full_pages:           form.fullPages,
      last_page_entries:    form.lastPageEntries,
      cars_remaining:       parseInt(String(form.carsRemaining)) || 0,
      clean_not_picked_up:  parseInt(String(form.cleanNotPickedUp)) || 0,
      team_size:            form.teamSize,
      overtime_hours:       form.overtimeHours,
      entered_by:           user.id,
      entered_at:           new Date().toISOString(),
    };

    const existing = backfillEntries.find(b => b.date.startsWith(openDate));
    if (existing) {
      await writeWithRefresh(() => supabase.from('washbay_backfill_logs').update(payload).eq('id', existing.id));
      setBackfillEntries(prev => prev.map(b => b.id === existing.id ? { ...b, ...{
        fullPages: form.fullPages, lastPageEntries: form.lastPageEntries,
        carsRemaining: parseInt(String(form.carsRemaining)) || 0,
        cleanNotPickedUp: parseInt(String(form.cleanNotPickedUp)) || 0,
        teamSize: form.teamSize, overtimeHours: form.overtimeHours,
      }} : b));
    } else {
      const { data } = await writeWithRefresh(() => supabase.from('washbay_backfill_logs').insert(payload).select('id').single());
      if (data) {
        setBackfillEntries(prev => [...prev, {
          id: (data as { id: string }).id, date: openDate,
          fullPages: form.fullPages, lastPageEntries: form.lastPageEntries,
          carsRemaining: parseInt(String(form.carsRemaining)) || 0,
          cleanNotPickedUp: parseInt(String(form.cleanNotPickedUp)) || 0,
          teamSize: form.teamSize, overtimeHours: form.overtimeHours,
          enteredBy: user.id, enteredAt: new Date().toISOString(),
        }]);
      }
    }

    setSaving(false);
    setOpenDate(null);
  };

  const INPUT = 'w-full px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';

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
                    <div className="px-5 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest pt-3">
                        {row.label} — Backfill Entry
                      </p>

                      {/* Gas sheet pages */}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Gas Sheet Pages</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Full pages</label>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setForm(f => ({ ...f, fullPages: Math.max(0, f.fullPages - 1) }))}
                                className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-sm font-semibold">−</button>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{form.fullPages}</span>
                              <button type="button" onClick={() => setForm(f => ({ ...f, fullPages: f.fullPages + 1 }))}
                                className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-sm font-semibold">+</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Last page entries</label>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setForm(f => ({ ...f, lastPageEntries: Math.max(0, f.lastPageEntries - 1) }))}
                                className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-sm font-semibold">−</button>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{form.lastPageEntries}</span>
                              <button type="button" onClick={() => setForm(f => ({ ...f, lastPageEntries: Math.min(19, f.lastPageEntries + 1) }))}
                                className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-sm font-semibold">+</button>
                            </div>
                          </div>
                        </div>
                        {(form.fullPages > 0 || form.lastPageEntries > 0) && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">
                            = {form.fullPages * 19 + form.lastPageEntries} cars in ✓
                          </p>
                        )}
                      </div>

                      {/* Numeric fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
                          <input type="number" min="0" value={form.carsRemaining} onChange={e => setForm(f => ({ ...f, carsRemaining: e.target.value }))} placeholder="0" className={INPUT} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
                          <input type="number" min="0" value={form.cleanNotPickedUp} onChange={e => setForm(f => ({ ...f, cleanNotPickedUp: e.target.value }))} placeholder="0" className={INPUT} />
                        </div>
                      </div>

                      {/* Team size */}
                      <div>
                        <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Team size</label>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setForm(f => ({ ...f, teamSize: Math.max(1, f.teamSize - 1) }))}
                            className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-lg font-semibold">−</button>
                          <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">{form.teamSize}</span>
                          <button type="button" onClick={() => setForm(f => ({ ...f, teamSize: f.teamSize + 1 }))}
                            className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-yellow-400 transition cursor-pointer flex items-center justify-center text-lg font-semibold">+</button>
                        </div>
                      </div>

                      {/* Overtime */}
                      <div>
                        <label className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 block">Overtime hours (if applicable)</label>
                        <div className="flex gap-2">
                          {[0, 1, 2, 3].map(h => (
                            <button key={h} type="button" onClick={() => setForm(f => ({ ...f, overtimeHours: h }))}
                              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                form.overtimeHours === h
                                  ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}>
                              {h === 0 ? '0' : `+${h}h`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-gray-900 text-sm font-semibold transition cursor-pointer"
                      >
                        {saving ? 'Saving…' : 'Save Entry'}
                      </button>
                    </div>
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
