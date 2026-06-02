import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getClassByPlate } from '../../data/ywgVehicleClasses';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayStartISO } from '../../lib/shiftDay';
import type { BranchId } from '../../types';

interface ClassCount {
  cls: string;
  count: number;
  plates: string[];
}

interface Props {
  activeBranch: BranchId | 'ALL';
}

function dayStart(): string {
  return shiftDayStartISO(localDateStr(0));
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function ClassDispatchSection({ activeBranch }: Props) {
  const [view, setView]               = useState<'daily' | 'monthly'>('daily');
  const [rows, setRows]               = useState<ClassCount[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setExpandedClass(null);

      let query = supabase
        .from('vsa_trips')
        .select('vehicle_plate')
        .ilike('arrive_location', 'airport%')
        .not('arrive_time', 'is', null)
        .gte('depart_time', view === 'daily' ? dayStart() : monthStart());

      if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);

      const { data } = await query;

      const counts: Record<string, string[]> = {};
      for (const row of (data ?? [])) {
        const plate = (row.vehicle_plate as string) ?? '';
        const cls   = getClassByPlate(plate) ?? 'Unregistered';
        if (!counts[cls]) counts[cls] = [];
        counts[cls].push(plate.toUpperCase());
      }

      const sorted = Object.entries(counts)
        .map(([cls, plates]) => ({ cls, count: plates.length, plates }))
        .sort((a, b) => {
          if (a.cls === 'Unregistered') return 1;
          if (b.cls === 'Unregistered') return -1;
          return b.count - a.count;
        });

      setRows(sorted);
      setLoading(false);
    }
    load();
  }, [view, activeBranch]);

  const maxCount = Math.max(
    1,
    ...rows.filter(r => r.cls !== 'Unregistered').map(r => r.count),
  );

  if (loading) return null;

  const monthLabel = new Date().toLocaleDateString('en-CA', { month: 'long' });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-sm">🚗</span>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Class Dispatch · {view === 'daily' ? 'Today' : monthLabel}
          </h2>
        </div>
        <div className="flex gap-1">
          {(['daily', 'monthly'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                view === v
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {v === 'daily' ? 'Today' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-gray-400 dark:text-gray-500 italic">
          No airport dispatches recorded{view === 'daily' ? ' today' : ' this month'}.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(({ cls, count, plates }) => {
            const isUnregistered = cls === 'Unregistered';
            const barPct         = isUnregistered ? 0 : Math.round((count / maxCount) * 100);
            const isExpanded     = expandedClass === cls;

            return (
              <div key={cls}>
                <button
                  type="button"
                  onClick={() => setExpandedClass(isExpanded ? null : cls)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition text-left"
                >
                  <span className={`text-xs font-bold w-16 shrink-0 ${
                    isUnregistered
                      ? 'text-gray-400 dark:text-gray-500 italic font-normal'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {cls}
                  </span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
                    {!isUnregistered && (
                      <div
                        className="h-full bg-yellow-400 dark:bg-yellow-500 rounded-sm"
                        style={{ width: `${barPct}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums w-5 text-right shrink-0">
                    {count}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 w-3">
                    {isExpanded ? '▴' : '▾'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                    {plates.map((plate, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 tabular-nums"
                      >
                        {plate}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
