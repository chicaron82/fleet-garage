import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSchedule } from '../../context/ScheduleContext';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { isMockPersona } from '../../lib/demo-accounts';
import { useShiftSwap } from './useShiftSwap';
import { isFullDayShift } from '../../types';
import type { ShiftType, ShiftWithUser } from '../../types';

function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m}${hr >= 12 ? 'p' : 'a'}`;
}

function shiftLabel(s: { shiftType: ShiftType; startTime?: string; endTime?: string }): string {
  if (s.shiftType === 'day-off') return 'Day Off';
  if (s.shiftType === 'pto') return 'PTO';
  if (s.shiftType === 'sick') return 'Sick';
  return `${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`;
}

interface Props {
  shift: ShiftWithUser;
  onClose: () => void;
}

/**
 * Swap or give away a shift from the week grid (Lead VSA and up). Swap trades the
 * source shift with another crew member's same-day shift; give-away drops the giver
 * to a day-off and hands the shift to anyone (roster staff included), surfacing a
 * replace-conflict if the taker already has a shift that day. Both go through
 * useShiftSwap as one confirmed action.
 */
export function SwapShiftSheet({ shift, onClose }: Props) {
  useEscapeKey(onClose);
  const { shifts } = useSchedule();
  const teamMembers = useTeamMembers();
  const { swap, giveAway, busy } = useShiftSwap();

  const [mode, setMode] = useState<'swap' | 'giveaway'>('swap');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const sameDayByUser = new Map(shifts.filter(s => s.date === shift.date).map(s => [s.userId, s]));
  const crew = teamMembers.filter(u => u.id !== shift.userId && !isMockPersona(u));
  // Swap needs someone with a shift to trade; give-away can hand off to anyone.
  const list = mode === 'swap' ? crew.filter(u => sameDayByUser.has(u.id)) : crew;

  const targetShift = targetId ? sameDayByUser.get(targetId) ?? null : null;
  const replaceConflict = mode === 'giveaway' && !!targetShift && !isFullDayShift(targetShift.shiftType);

  const confirm = async () => {
    if (!targetId) return;
    if (mode === 'swap') {
      const t = sameDayByUser.get(targetId);
      if (t) await swap(shift, t, note);
    } else {
      await giveAway(shift, targetId, sameDayByUser.get(targetId) ?? null, note);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Swap / Give Away</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{shift.user.name.split(' ')[0]} · {shiftLabel(shift)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['swap', 'giveaway'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setTargetId(null); }}
              className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                mode === m
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
            >
              {m === 'swap' ? 'Swap with…' : 'Give away'}
            </button>
          ))}
        </div>

        <div className="space-y-1 max-h-56 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-3 text-center">
              {mode === 'swap' ? 'No one else is scheduled that day to swap with.' : 'No crew available.'}
            </p>
          ) : list.map(u => {
            const theirs = sameDayByUser.get(u.id);
            const selected = targetId === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setTargetId(u.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                  selected
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400'
                    : 'border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{u.name.split(' ')[0]}{u.rosterOnly ? ' (roster)' : ''}</span>
                <span className="text-gray-400 dark:text-gray-500">{theirs ? shiftLabel(theirs) : 'no shift'}</span>
              </button>
            );
          })}
        </div>

        {replaceConflict && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            {list.find(u => u.id === targetId)?.name.split(' ')[0]} already has a shift that day ({shiftLabel(targetShift!)}) — confirming will replace it.
          </p>
        )}

        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional) — e.g. swapped with Mohammed"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
        />

        <button
          onClick={confirm}
          disabled={!targetId || busy}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-40 cursor-pointer transition"
        >
          {busy ? 'Working…' : mode === 'swap' ? 'Confirm swap' : 'Confirm give-away'}
        </button>
      </div>
    </div>
  );
}
