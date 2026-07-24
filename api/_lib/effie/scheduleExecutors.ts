// Effie executors — schedule domain: who's on a given day, and the operator's own upcoming shifts.
// Read-only. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { todayInWinnipeg, scheduleDateLabel, addDaysISO } from '../effieHelpers.js';
import { formatSchedule, type ScheduleGroup } from '../scheduleSummary.js';
import { formatMyShifts, type MyShiftRow } from '../moduleReads.js';

/** Read-only: who's on which shift for a date ("who's closing with me tonight?"). */
export async function executeLookupSchedule(
  supabase: SupabaseClient,
  userId: string,
  input: { date?: string; shift_type?: string },
): Promise<string> {
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayInWinnipeg();
  const { data: shiftRows, error } = await supabase.from('shifts').select('user_id, shift_type').eq('date', date);
  if (error) throw error;
  // The asker's OWN shift, pulled before the self-filter below — so Effie can frame the
  // roster around it ("you're on mids, with you today: …") instead of asking the operator
  // what shift they're on. Undefined if they're not scheduled that day.
  const yourShift = (shiftRows ?? []).find((r) => r.user_id === userId)?.shift_type;

  // "Who's on WITH me" — exclude the asker from their own roster (this tool is always
  // "with me" framed). Mirrors the cockpit's teammatesOnToday self-filter. If the asker
  // is the only one on a shift, that group is empty → "nobody else", which is correct.
  const rows = (shiftRows ?? []).filter((r) => r.user_id !== userId);

  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
    for (const p of profs ?? []) names.set(p.id, p.name ?? 'Unknown');
  }

  const byType = new Map<string, string[]>();
  for (const r of rows) {
    const list = byType.get(r.shift_type) ?? [];
    list.push(names.get(r.user_id) ?? 'Unknown');
    byType.set(r.shift_type, list);
  }
  const groups: ScheduleGroup[] = [...byType].map(([shiftType, people]) => ({ shiftType, people }));
  // The teammates actually on the operator's OWN shift, computed from data (self already
  // excluded from `rows`). Empty = literally nobody else shares their shift — so Effie
  // states that from fact instead of grabbing an adjacent group to fill the gap.
  const yourShiftMates = yourShift ? (byType.get(yourShift) ?? []) : [];
  const shiftType = typeof input.shift_type === 'string' ? input.shift_type : undefined;
  return JSON.stringify({
    date,
    yourShift,
    yourShiftMates,
    groups,
    summary: formatSchedule(scheduleDateLabel(date), groups, shiftType),
  });
}


/** Read-only: the asking user's own upcoming shifts + rough scheduled hours. */
export async function executeLookupMyShift(supabase: SupabaseClient, userId: string, input: { days?: number }): Promise<string> {
  const days = Number.isFinite(input.days) ? Math.max(1, Math.min(31, Number(input.days))) : 7;
  const start = todayInWinnipeg();
  const end = addDaysISO(start, days);
  const { data, error } = await supabase
    .from('shifts')
    .select('date, shift_type')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  const rows: MyShiftRow[] = (data ?? []).map((r) => ({ dateLabel: scheduleDateLabel(r.date), shiftType: r.shift_type }));
  return JSON.stringify({ from: start, to: end, summary: formatMyShifts(rows) });
}
