import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import type { OffStandardReason } from '../../types';
import { OFF_STANDARD_LABELS } from '../../types';

const REASONS: OffStandardReason[] = ['CLASS', 'WFW', 'MTG', 'WTH', 'OTH'];

function localHHMM(minsAgo: number): string {
  const d = new Date(Date.now() - minsAgo * 60000);
  return d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function hmToTodayISO(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  onSubmit: (startTime: string, endTime: string, reason: OffStandardReason, notes: string) => void;
  onClose: () => void;
}

export function BackdateEntrySheet({ onSubmit, onClose }: Props) {
  const [startHM, setStartHM] = useState(localHHMM(90));
  const [endHM, setEndHM]     = useState(localHHMM(60));
  const [reason, setReason]   = useState<OffStandardReason>('OTH');
  const [notes, setNotes]     = useState('');

  const now      = new Date();
  const startISO = startHM ? hmToTodayISO(startHM) : null;
  const endISO   = endHM   ? hmToTodayISO(endHM)   : null;

  const startErr = startISO && new Date(startISO) > now ? 'Start time cannot be in the future' : null;
  const endErr   = !endISO || !startISO ? null
    : new Date(endISO) > now          ? 'End time cannot be in the future'
    : new Date(endISO) <= new Date(startISO) ? 'End time must be after start time'
    : null;

  const minutes    = startISO && endISO && !startErr && !endErr
    ? Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000)
    : 0;
  const canSubmit  = !startErr && !endErr && !!startISO && !!endISO && !!notes.trim() && minutes >= 5;

  const handleSubmit = () => {
    if (!canSubmit || !startISO || !endISO) return;
    hapticLight();
    onSubmit(startISO, endISO, reason, notes.trim());
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-200">

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Log Past Time</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Time pickers */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 mb-1.5">Start</p>
            <input
              type="time"
              value={startHM}
              onChange={e => setStartHM(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {startErr && <p className="text-xs text-red-500 mt-1">{startErr}</p>}
          </div>
          <span className="text-gray-400 self-center mt-4">→</span>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 mb-1.5">End</p>
            <input
              type="time"
              value={endHM}
              onChange={e => setEndHM(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {endErr && <p className="text-xs text-red-500 mt-1">{endErr}</p>}
          </div>
        </div>

        {minutes >= 5 && !startErr && !endErr && (
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 -mt-2">{fmtDuration(minutes)}</p>
        )}

        {/* Reason */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Reason</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { hapticLight(); setReason(r); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  reason === r
                    ? 'bg-yellow-400 border-yellow-400 text-gray-900'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {r} · {OFF_STANDARD_LABELS[r].full}
              </button>
            ))}
          </div>
        </div>

        {/* Notes (required) */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Notes <span className="font-normal normal-case">(required)</span>
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Briefly describe what you were doing…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>

        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          ⚠️ Backdated entries require management approval before counting toward your rate
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            Submit for Approval
          </button>
        </div>

      </div>
    </>
  );
}
