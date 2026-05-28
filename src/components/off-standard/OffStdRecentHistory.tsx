import { useState, useEffect } from 'react';
import type { User, ShiftWithUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { fmtMinutes } from '../../lib/offStandardReport';
import { formatDateStr } from '../../lib/buildShiftReport';
import { OffStdExportActionSheet } from './OffStdExportActionSheet';

interface OthDay {
  date: string;
  totalMinutes: number;
  entryCount: number;
}

interface Props {
  user: User;
  shifts: ShiftWithUser[];
}

export function OffStdRecentHistory({ user, shifts }: Props) {
  const [history, setHistory] = useState<OthDay[]>([]);
  const [exportDate, setExportDate] = useState<string | null>(null);

  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    supabase
      .from('off_standard_entries')
      .select('date, minutes')
      .eq('user_id', user.id)
      .gte('date', cutoffDate)
      .not('minutes', 'is', null)
      .or('is_backdated.is.null,is_backdated.eq.false,edit_status.eq.approved')
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const byDate = new Map<string, { total: number; count: number }>();
        for (const row of data as { date: string; minutes: number }[]) {
          const cur = byDate.get(row.date) ?? { total: 0, count: 0 };
          byDate.set(row.date, { total: cur.total + (row.minutes ?? 0), count: cur.count + 1 });
        }
        const days: OthDay[] = [...byDate.entries()]
          .map(([date, { total, count }]) => ({ date, totalMinutes: total, entryCount: count }))
          .slice(0, 5);
        setHistory(days);
      });
  }, [user.id]);

  if (history.length === 0) return null;

  const exportDay = exportDate ? history.find(h => h.date === exportDate) : null;

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Recent OTH</p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {history.map(day => (
            <button
              key={day.date}
              type="button"
              onClick={() => setExportDate(day.date)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {formatDateStr(day.date).split(',')[0]}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">{', ' + formatDateStr(day.date).split(',').slice(1).join(',')}</span>
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500">↗</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>⏱ {fmtMinutes(day.totalMinutes)}</span>
                <span>{day.entryCount} {day.entryCount === 1 ? 'entry' : 'entries'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {exportDate && exportDay && (
        <OffStdExportActionSheet
          date={exportDate}
          dateLabel={formatDateStr(exportDate)}
          user={user}
          shifts={shifts}
          onClose={() => setExportDate(null)}
        />
      )}
    </>
  );
}
