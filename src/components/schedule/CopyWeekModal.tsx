import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSchedule } from '../../context/ScheduleContext';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { supabase } from '../../lib/supabase';
import { toISO, getWeekBounds } from '../../lib/schedule-helpers';
import { isStatDay, getStatName } from '../../lib/stats';
import { planWeekCopy, describeWeekCopy, statDatesIn, shiftISODate } from '../../lib/planWeekCopy';
import type { Shift, UserRole } from '../../types';

/**
 * "Repeat last week" — copy one week of shifts onto another.
 *
 * ⭐ Aaron, mid-shift 2026-08-31, after I did it for him by hand: *"could there be an option in FG to
 * do that?"* and then, on being told the answer was to ask me: *"so can't be done through FG. I just
 * have to ask you when the time comes?"* — which is the argument for building it. A routine weekly
 * task that only works when a session is running is not a feature, it is a dependency, and FG is his.
 *
 * ⚠️ The DECISIONS are not in here — they are in `lib/planWeekCopy`, pure and tested. This file owns
 * the two reads, the preview and the confirm.
 */
interface Props { onClose: () => void }

type Row = Pick<Shift, 'userId' | 'date' | 'startTime' | 'endTime' | 'shiftType'>;

const label = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

export function CopyWeekModal({ onClose }: Props) {
  const { bulkCreateShifts, currentDate, refresh } = useSchedule();
  const team = useTeamMembers();
  useEscapeKey(onClose);

  // The week on screen is the TARGET; the source defaults to the week before it, which is the ask
  // ("repeat last week") with no configuration at all. `weeksBack` lets him reach further when the
  // most recent week is the odd one.
  const target = useMemo(() => getWeekBounds(currentDate), [currentDate]);
  const [weeksBack, setWeeksBack] = useState(1);
  const offset = weeksBack * 7;
  const srcStart = shiftISODate(toISO(target.start), -offset);
  const srcEnd = shiftISODate(toISO(target.end), -offset);

  // ⚠️ Role scope, because a copy across the whole branch is rarely what he means. Drivers repeat
  // weekly; the VSA block arrives as a 4-week PDF and must not be casually re-copied over.
  const roles = useMemo(() => [...new Set(team.map(m => m.role))].sort(), [team]);
  const [role, setRole] = useState<UserRole | 'ALL'>('Driver');
  const roleOf = useMemo(() => new Map(team.map(m => [m.id, m.role])), [team]);

  // ⚠️ ONE STATE OBJECT CARRYING THE KEY IT WAS LOADED FOR, rather than nulling the rows on the way
  // in. The repo lints `set-state-in-effect`, and resetting synchronously at the top of the fetch is
  // exactly that — but it is also a real bug it prevents: a slow response for LAST week could land
  // after he has already stepped the picker to three-weeks-back, and paint the wrong preview under
  // the right label. Comparing the stored key to the current one makes a stale answer unusable
  // instead of merely unlikely.
  const [data, setData] = useState<{ key: string; source: Row[]; existing: Pick<Shift, 'userId' | 'date'>[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const key = `${srcStart}|${toISO(target.start)}`;

  // Both weeks are read HERE rather than from the context: `loadShifts` is windowed to what is on
  // screen, so the source week is usually not in memory at all.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [src, tgt] = await Promise.all([
        supabase.from('shifts').select('user_id,date,start_time,end_time,shift_type').gte('date', srcStart).lte('date', srcEnd),
        supabase.from('shifts').select('user_id,date').gte('date', toISO(target.start)).lte('date', toISO(target.end)),
      ]);
      if (!live) return;
      if (src.error || tgt.error) { setError('Could not read those weeks — check the connection.'); return; }
      setData({
        key: `${srcStart}|${toISO(target.start)}`,
        source: (src.data ?? []).map(r => ({
          userId: r.user_id as string, date: r.date as string,
          startTime: (r.start_time as string | null) ?? undefined,
          endTime: (r.end_time as string | null) ?? undefined,
          shiftType: r.shift_type as Shift['shiftType'],
        })),
        existing: (tgt.data ?? []).map(r => ({ userId: r.user_id as string, date: r.date as string })),
      });
    })();
    return () => { live = false; };
  }, [srcStart, srcEnd, target.start, target.end]);

  const fresh = data && data.key === key ? data : null;

  const inScope = useCallback((userId: string) => role === 'ALL' || roleOf.get(userId) === role, [role, roleOf]);
  const plan = useMemo(
    () => planWeekCopy((fresh?.source ?? []).filter(s => inScope(s.userId)), fresh?.existing ?? [], offset, isStatDay),
    [fresh, offset, inScope],
  );
  const stats = statDatesIn(plan);
  const ready = fresh !== null;

  const handleCopy = async () => {
    if (plan.creates.length === 0) return;
    setSaving(true); setError('');
    try {
      await bulkCreateShifts(plan.creates.map(c => ({
        userId: c.userId, date: c.date, startTime: c.startTime, endTime: c.endTime,
        shiftType: c.shiftType, isStat: c.isStat,
      })));
      refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy that week.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Repeat a week</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Copies <strong>{label(srcStart)} – {label(srcEnd)}</strong> onto{' '}
          <strong>{label(toISO(target.start))} – {label(toISO(target.end))}</strong>.
          A day that already has a shift is never touched, so anything you have already changed stays.
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Copy from</label>
          <select value={weeksBack} onChange={e => setWeeksBack(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition">
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>
                {n === 1 ? 'Last week' : `${n} weeks back`} · {label(shiftISODate(toISO(target.start), -n * 7))}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Who</label>
          <select value={role} onChange={e => setRole(e.target.value as UserRole | 'ALL')}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition">
            {roles.map(r => <option key={r} value={r}>{r}s</option>)}
            <option value="ALL">Everyone</option>
          </select>
        </div>

        {/* ⚠️ The preview is not decoration. After one copy every day in the target week is taken, so
            a second run legitimately does nothing — which looks exactly like a broken button unless
            the count is readable BEFORE the tap. */}
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          !ready ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          : plan.creates.length > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
          {ready ? describeWeekCopy(plan) : 'Reading both weeks…'}
        </div>

        {/* ⭐ The stat, said out loud. It is the one field that does NOT come from the source week —
            it is re-derived for the target — and that is invisible unless it is named. */}
        {stats.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ {stats.map(d => `${getStatName(d) ?? 'Stat'} (${label(d)})`).join(', ')} —
            marked as a stat on the new shifts, whatever the week you copied from said.
          </p>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer">
            Cancel
          </button>
          <button onClick={handleCopy} disabled={saving || !ready || plan.creates.length === 0}
            className="flex-1 py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 text-white dark:text-gray-900 font-semibold text-sm rounded-lg transition cursor-pointer">
            {saving ? 'Copying…' : 'Copy week'}
          </button>
        </div>
      </div>
    </div>
  );
}
