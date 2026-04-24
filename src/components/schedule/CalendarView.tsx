import { useState } from 'react';
import { useSchedule, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { DayDetailModal } from './DayDetailModal';
import { ShiftForm } from './ShiftForm';
import { FlipShiftSheet } from './FlipShiftSheet';
import type { ShiftType, ShiftWithUser } from '../../types';

const TYPE_DOT: Record<ShiftType, string> = {
  'opening': 'bg-blue-400',
  'mid':     'bg-teal-400',
  'closing': 'bg-yellow-400',
  'day-off': 'bg-gray-300 dark:bg-gray-600',
};

function getMonthDays(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
  return days;
}

interface Props { today: string; }

export function CalendarView({ today }: Props) {
  const { shifts, currentDate, loading } = useSchedule();
  const { user } = useAuth();
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [addForDate, setAddForDate] = useState<string | null>(null);
  const [flipShift,  setFlipShift]  = useState<ShiftWithUser | null>(null);

  const days = getMonthDays(currentDate);
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        {loading && (
          <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">Loading…</div>
        )}
        {/* DOW header */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
          {DOW_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="border-b border-r border-gray-50 dark:border-gray-800/50 h-16" />;

            const iso = toISO(day);
            const isToday = iso === today;
            const dayShifts = shifts.filter(s => s.date === iso);
            const myShift = dayShifts.find(s => s.userId === user?.id);

            // Deduplicate dots by shift type
            const types = [...new Set(dayShifts.map(s => s.shiftType))];

            return (
              <button
                key={iso}
                onClick={() => myShift ? setFlipShift(myShift) : setDetailDate(iso)}
                className={`border-b border-r border-gray-50 dark:border-gray-800/50 h-16 p-1.5 flex flex-col items-start text-left transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  isToday ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''
                } ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}
              >
                <span className={`text-xs font-semibold ${
                  isToday
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {day.getDate()}
                </span>
                {/* My shift indicator */}
                {myShift && (
                  <span className={`mt-0.5 text-xs font-medium leading-none px-1 py-0.5 rounded ${
                    myShift.shiftType === 'day-off'
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {myShift.shiftType === 'day-off' ? 'Off' : myShift.startTime?.slice(0, 5)}
                  </span>
                )}
                {/* Crew dots */}
                {types.length > 0 && (
                  <div className="flex gap-0.5 mt-auto flex-wrap">
                    {types.map(t => (
                      <div key={t} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[t]}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs px-1">
        {(['opening', 'mid', 'closing', 'day-off'] as ShiftType[]).map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${TYPE_DOT[t]}`} />
            <span className="text-gray-500 dark:text-gray-400 capitalize">{t === 'day-off' ? 'Day off' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </div>
        ))}
      </div>

      {detailDate && (
        <DayDetailModal
          date={detailDate}
          onClose={() => setDetailDate(null)}
          onAddShift={() => { setDetailDate(null); setAddForDate(detailDate); }}
        />
      )}
      {addForDate && (
        <ShiftForm
          mode="add"
          initialDate={addForDate}
          onClose={() => setAddForDate(null)}
        />
      )}
      {flipShift && (
        <FlipShiftSheet
          shift={flipShift}
          onClose={() => setFlipShift(null)}
        />
      )}
    </>
  );
}
