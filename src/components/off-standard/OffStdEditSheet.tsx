import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import type { OffStandardEntry } from '../../types';

interface Props {
  entry: OffStandardEntry;
  onSave: (newEndTime: string, newMinutes: number, explanation: string) => void;
  onRequest: (newEndTime: string, newMinutes: number, editNote: string, explanation: string) => void;
  onClose: () => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function OffStdEditSheet({ entry, onSave, onRequest, onClose }: Props) {
  const [endTime, setEndTime] = useState(new Date(entry.stopTime));
  const [note, setNote] = useState(entry.explanation ?? '');
  const [editNote, setEditNote] = useState('');

  const newMinutes = Math.round(
    (endTime.getTime() - new Date(entry.startTime).getTime()) / 60000
  );
  const delta = newMinutes - entry.minutes;
  const isLonger = delta > 0;
  const isSame = delta === 0;
  const noteChanged = note !== (entry.explanation ?? '');

  const minEnd = new Date(new Date(entry.startTime).getTime() + 5 * 60000);
  const canDecrease = endTime.getTime() - 60000 >= minEnd.getTime();

  const adjust = (mins: number) => {
    hapticLight();
    setEndTime(prev => new Date(prev.getTime() + mins * 60000));
  };

  const handleSubmit = () => {
    if (isSame && !noteChanged) { onClose(); return; }
    hapticLight();
    if (isLonger) {
      onRequest(endTime.toISOString(), newMinutes, editNote.trim(), note.trim());
    } else {
      onSave(endTime.toISOString(), newMinutes, note.trim());
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Entry</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 mb-1">Start</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{fmtTime(entry.startTime)}</p>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 mb-1">End</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{fmtTime(endTime.toISOString())}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Adjust end time</p>
          <div className="flex gap-2">
            {([[-5, '−5m'], [-1, '−1m'], [1, '+1m'], [5, '+5m']] as [number, string][]).map(([n, label]) => (
              <button
                key={label}
                onClick={() => adjust(n)}
                disabled={n < 0 && !canDecrease}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          {!isSame && (
            <p className={`text-xs font-semibold ${isLonger ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
              {delta > 0 ? '+' : ''}{delta}m → {fmtMinutes(newMinutes)} total
            </p>
          )}
        </div>

        {/* Entry note — always visible, locked for auto-trip entries */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Notes{entry.autoFromTrip && <span className="font-normal normal-case"> (auto-generated)</span>}
          </p>
          <textarea
            value={note}
            onChange={e => { if (!entry.autoFromTrip) setNote(e.target.value); }}
            readOnly={entry.autoFromTrip}
            rows={2}
            placeholder="Add context for this entry…"
            className={`w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${entry.autoFromTrip ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* Edit reason — only for longer, approval context */}
        {isLonger && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Reason for edit <span className="font-normal normal-case">(optional)</span>
            </p>
            <textarea
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              rows={2}
              placeholder="Help your manager understand the context…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ This edit requires management approval
            </p>
          </div>
        )}

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
            disabled={isSame && !noteChanged}
            className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${
              isLonger
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLonger ? 'Request Approval' : 'Save'}
          </button>
        </div>

      </div>
    </>
  );
}
