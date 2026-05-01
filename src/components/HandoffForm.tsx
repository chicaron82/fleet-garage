import { useState } from 'react';
import { useGarage } from '../context/GarageContext';
import type { LotStatus } from '../types';

interface Props {
  onClose: () => void;
}

const LOT_STATUS_OPTIONS: { value: LotStatus; label: string; description: string; color: string }[] = [
  { value: 'zeroed',    label: 'Zeroed',     description: 'All cars accounted for, queue clear',     color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'manageable', label: 'Manageable', description: 'Backlog present, incoming shift can handle', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'backlog',   label: 'Backlog',    description: 'Significant queue, needs immediate attention', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
];

export function HandoffForm({ onClose }: Props) {
  const { submitHandoff } = useGarage();

  const [dirtiesInQueue,  setDirtiesInQueue]  = useState('');
  const [cleansAtAirport, setCleansAtAirport] = useState('');
  const [lotStatus,       setLotStatus]       = useState<LotStatus>('manageable');
  const [expectedReturns, setExpectedReturns] = useState('');
  const [notes,           setNotes]           = useState('');
  const [submitting,      setSubmitting]       = useState(false);

  const dirties = parseInt(dirtiesInQueue)  || 0;
  const cleans  = parseInt(cleansAtAirport) || 0;

  const canSubmit = !submitting && dirtiesInQueue !== '' && cleansAtAirport !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await submitHandoff({
      dirtiesInQueue:  dirties,
      cleansAtAirport: cleans,
      lotStatus,
      expectedReturns: expectedReturns.trim() || undefined,
      notes:           notes.trim() || undefined,
    });
    if (ok) onClose();
    else setSubmitting(false);
  };

  const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';
  const TEXTAREA = `${INPUT} resize-none`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Log Shift Handoff</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Queue counts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Dirties in queue</label>
              <input
                type="number" min="0" value={dirtiesInQueue}
                onChange={e => setDirtiesInQueue(e.target.value)}
                placeholder="0"
                className={INPUT}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Cleans at airport</label>
              <input
                type="number" min="0" value={cleansAtAirport}
                onChange={e => setCleansAtAirport(e.target.value)}
                placeholder="0"
                className={INPUT}
              />
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

          {/* Expected returns */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Expected returns (optional)</label>
            <input
              type="text" value={expectedReturns}
              onChange={e => setExpectedReturns(e.target.value)}
              placeholder="e.g. Unit 304 by 14:00, unit 211 TBD"
              className={INPUT}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
            <textarea
              rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the next shift needs to know…"
              className={TEXTAREA}
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
