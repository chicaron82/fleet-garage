import { useState } from 'react';
import { useGarage } from '../context/GarageContext';
import type { LotStatus } from '../types';

interface Props {
  onClose: () => void;
}

const LOT_STATUS_OPTIONS: { value: LotStatus; label: string; description: string; color: string }[] = [
  { value: 'zeroed',     label: 'Zeroed',     description: 'All cars accounted for, queue clear',          color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'manageable', label: 'Manageable', description: 'Backlog present, incoming shift can handle',   color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'backlog',    label: 'Backlog',    description: 'Significant queue, needs immediate attention',  color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
];

const STEP_BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';
const STEP_VAL = 'text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums';

export function HandoffForm({ onClose }: Props) {
  const { submitHandoff } = useGarage();

  const [fullPages,       setFullPages]       = useState(0);
  const [lastPageEntries, setLastPageEntries] = useState(0);
  const [teamSize,        setTeamSize]        = useState(3);
  const [lotStatus,       setLotStatus]       = useState<LotStatus>('manageable');
  const [notes,           setNotes]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const carsIn    = fullPages * 19 + lastPageEntries;
  const canSubmit = !submitting && carsIn > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await submitHandoff({
      fullPages,
      lastPageEntries,
      teamSize,
      lotStatus,
      notes: notes.trim() || undefined,
    });
    if (ok) onClose();
    else setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Log Shift Handoff</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Gas sheet pages */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gas Sheet Pages — This Shift</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Full pages</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFullPages(v => Math.max(0, v - 1))} className={STEP_BTN}>−</button>
                  <span className={STEP_VAL}>{fullPages}</span>
                  <button type="button" onClick={() => setFullPages(v => v + 1)} className={STEP_BTN}>+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Last page entries</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setLastPageEntries(v => Math.max(0, v - 1))} className={STEP_BTN}>−</button>
                  <span className={STEP_VAL}>{lastPageEntries}</span>
                  <button type="button" onClick={() => setLastPageEntries(v => Math.min(19, v + 1))} className={STEP_BTN}>+</button>
                </div>
              </div>
            </div>
            {carsIn > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">= {carsIn} cars cleaned this shift ✓</p>
            )}
          </div>

          {/* Team size */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Team size</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setTeamSize(v => Math.max(1, v - 1))}
                className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">−</button>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">{teamSize}</span>
              <button type="button" onClick={() => setTeamSize(v => v + 1)}
                className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">+</button>
            </div>
          </div>

          {/* Lot status pills */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Lot Status</p>
            <div className="space-y-2">
              {LOT_STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLotStatus(opt.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition cursor-pointer ${
                    lotStatus === opt.value
                      ? opt.color
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs ml-2 opacity-70">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
            <textarea
              rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the next shift needs to know…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              canSubmit
                ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Logging…' : 'Log Handoff'}
          </button>
        </div>

      </div>
    </div>
  );
}
