import { useState } from 'react';
import { useSchedule, getWeekBounds, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { USERS } from '../../data/mock';
import { ShiftForm } from './ShiftForm';
import { FlipShiftSheet } from './FlipShiftSheet';
import { calcOT, fmtHours } from '../../lib/ot';
import type { ShiftType, ShiftWithUser } from '../../types';

const SHIFT_COLORS: Record<ShiftType, string> = {
  'opening': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'mid':     'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  'closing': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'day-off': 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m}${hr >= 12 ? 'p' : 'a'}`;
}

interface Props { today: string; }

export function WeekView({ today }: Props) {
  const { shifts, currentDate, canEditShift, loading } = useSchedule();
  const { user } = useAuth();
  const [editShift, setEditShift]     = useState<ShiftWithUser | null>(null);
  const [flipShift, setFlipShift]     = useState<ShiftWithUser | null>(null);
  const [addForDate, setAddForDate]   = useState<string | null>(null);

  // Build 7 days of this week (Mon–Sun)
  const { start } = getWeekBounds(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  // Build shift lookup: `${userId}-${date}` → shift
  const shiftMap = new Map<string, ShiftWithUser>();
  for (const s of shifts) shiftMap.set(`${s.userId}-${s.date}`, s);

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto transition-colors">
        {loading && (
          <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">Loading…</div>
        )}
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-2.5 px-3 text-gray-400 dark:text-gray-500 font-semibold w-20">Staff</th>
              {days.map((d, i) => {
                const iso = toISO(d);
                const isToday = iso === today;
                return (
                  <th key={i} className={`text-center py-2.5 px-1 font-semibold ${
                    isToday ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <div>{DAY_NAMES[i]}</div>
                    <div className="font-normal text-gray-400 dark:text-gray-600">{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {USERS.map(u => {
              const isMe = u.id === user?.id;
              return (
                <tr
                  key={u.id}
                  className={`border-t border-gray-100 dark:border-gray-800 ${
                    isMe ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    <div>{u.name.split(' ')[0]}</div>
                    <div className="text-gray-400 dark:text-gray-600 font-normal">{u.role.replace('Operations Manager', 'Ops Mgr').replace('Branch Manager', 'Br. Mgr')}</div>
                  </td>
                  {days.map((d, i) => {
                    const iso = toISO(d);
                    const shift = shiftMap.get(`${u.id}-${iso}`);
                    const isToday = iso === today;
                    const canEdit = shift ? canEditShift(shift) : isMe;

                    return (
                      <td key={i} className={`text-center px-1 py-2 ${isToday ? 'bg-yellow-50/30 dark:bg-yellow-900/5' : ''}`}>
                        {shift ? (
                          <button
                            onClick={() => {
                              if (isMe) setFlipShift(shift);
                              else if (canEdit) setEditShift(shift);
                            }}
                            className={`w-full px-1 py-1 rounded-md text-xs font-medium transition ${SHIFT_COLORS[shift.shiftType]} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {shift.shiftType === 'day-off' ? (
                              <>
                                OFF
                                {shift.isStat && <span className="block text-amber-500 text-[10px] leading-tight">★</span>}
                              </>
                            ) : (
                              <>
                                {fmtTime(shift.startTime)}<br />{fmtTime(shift.endTime)}
                                {shift.isStat && <span className="block text-amber-500 text-[10px] leading-tight mt-0.5">★ stat</span>}
                                {calcOT(shift) > 0 && (
                                  <span className="block text-amber-600 dark:text-amber-400 font-semibold text-[10px] leading-tight">
                                    +{fmtHours(calcOT(shift))} OT
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        ) : isMe ? (
                          <button
                            onClick={() => setAddForDate(iso)}
                            className="w-full py-1 text-gray-300 dark:text-gray-600 hover:text-yellow-500 dark:hover:text-yellow-400 text-base font-light transition cursor-pointer"
                            aria-label={`Add shift ${DAY_NAMES[i]}`}
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-gray-200 dark:text-gray-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs px-1">
        {(['opening', 'mid', 'closing', 'day-off'] as ShiftType[]).map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${SHIFT_COLORS[t].split(' ')[0]}`} />
            <span className="text-gray-500 dark:text-gray-400 capitalize">{t === 'day-off' ? 'Day off' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      {editShift && (
        <ShiftForm
          mode="edit"
          initial={editShift}
          onClose={() => setEditShift(null)}
        />
      )}
      {flipShift && (
        <FlipShiftSheet
          shift={flipShift}
          onClose={() => setFlipShift(null)}
        />
      )}
      {addForDate && (
        <ShiftForm
          mode="add"
          initialDate={addForDate}
          onClose={() => setAddForDate(null)}
        />
      )}
    </>
  );
}
