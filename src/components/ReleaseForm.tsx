import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import type { ReleaseType } from '../types';

interface Props {
  holdId: string;
  vehicleId: string;
  onClose: () => void;
}

const EXCEPTION_REASONS = [
  'Damage documented — vehicle serviceable for rental',
  'Awaiting parts — vehicle cleared for limited use',
  'Customer accepted known damage',
  'Repair appointment scheduled',
  'Insurance claim filed — vehicle cleared',
  'Management decision — operational need',
];

const PRE_EXISTING_REASONS = [
  'Known damage — vehicle cleared for regular rental',
  'Age-related wear — below repair threshold',
  'Minor cosmetic — no safety concern',
  'Repair cost exceeds vehicle value',
  'Management decision — accepted condition',
  'Insurance write-off pending — vehicle in use',
];

const DETAIL_EXCEPTION_REASONS = [
  'Vacuumed / cleaned in-house — cleared',
  'Contract closed — detail not pursued',
  'Acceptable for rental as-is',
  'Sent for professional detail',
];

export function ReleaseForm({ holdId, onClose }: Props) {
  const { user } = useAuth();
  const { addRelease, holds } = useGarage();

  const hold = holds.find(h => h.id === holdId);
  const isDetailHold = hold?.holdType === 'detail';

  const [releaseType, setReleaseType] = useState<ReleaseType>('EXCEPTION');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = releaseType === 'EXCEPTION'
    ? (isDetailHold ? DETAIL_EXCEPTION_REASONS : EXCEPTION_REASONS)
    : PRE_EXISTING_REASONS;
  const finalReason = reason === '__custom__' ? customReason.trim() : reason;
  const needsReturn = releaseType === 'EXCEPTION';
  const canSubmit = finalReason && (!needsReturn || expectedReturn) && !submitting;

  // Reset reason when switching type
  const handleTypeChange = (t: ReleaseType) => {
    setReleaseType(t);
    setReason('');
    setCustomReason('');
    if (t === 'PRE_EXISTING') setExpectedReturn('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await addRelease(holdId, {
        holdId,
        approvedById: user!.id,
        approvedAt: new Date().toISOString(),
        releaseType,
        releaseMethod: 'standard',
        reason: finalReason,
        expectedReturn: needsReturn ? expectedReturn : undefined,
        notes,
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  const isException = releaseType === 'EXCEPTION';

  return (
    <div className={`bg-white dark:bg-gray-900 transition-colors rounded-xl border overflow-hidden ${isException ? 'border-amber-200 dark:border-amber-800/50' : 'border-blue-200'}`}>
      <div className={`px-5 py-4 border-b ${isException ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-sm ${isException ? 'text-amber-900' : 'text-blue-900'}`}>
              Approve Release
            </h3>
            <p className={`text-xs mt-0.5 ${isException ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700'}`}>
              {isException ? 'Vehicle will move to Out on Exception status' : 'Vehicle will be marked Pre-existing — renting as-is'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`transition text-lg leading-none cursor-pointer ${isException ? 'text-amber-400 hover:text-amber-700 dark:text-amber-400' : 'text-blue-400 hover:text-blue-700'}`}
          >
            ×
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* Release Type Toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Release Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('EXCEPTION')}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                isException
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-900'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors'
              }`}
            >
              <span className="block text-sm font-semibold">Exception</span>
              <span className="block text-xs opacity-70 mt-0.5">Temporary — has return date</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('PRE_EXISTING')}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                !isException
                  ? 'border-blue-400 bg-blue-50 text-blue-900'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors'
              }`}
            >
              <span className="block text-sm font-semibold">Pre-existing</span>
              <span className="block text-xs opacity-70 mt-0.5">Renting as-is — no repair planned</span>
            </button>
          </div>
        </div>

        {/* Release Reason */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Reason *
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition bg-white dark:bg-gray-900 transition-colors ${
              isException ? 'focus:ring-amber-400' : 'focus:ring-blue-400'
            }`}
          >
            <option value="">Select a reason…</option>
            {reasons.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="__custom__">Other (specify below)</option>
          </select>
          {reason === '__custom__' && (
            <input
              type="text"
              placeholder="Describe the release reason…"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              className={`mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                isException ? 'focus:ring-amber-400' : 'focus:ring-blue-400'
              }`}
            />
          )}
        </div>

        {/* Expected Return Date — EXCEPTION only */}
        {isException && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
              Expected Return Date *
            </label>
            <input
              type="date"
              value={expectedReturn}
              onChange={e => setExpectedReturn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Additional context for the record…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none ${
              isException ? 'focus:ring-amber-400' : 'focus:ring-blue-400'
            }`}
          />
        </div>

        {/* Approver info */}
        <div className="bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          Approving as <span className="font-medium text-gray-700 dark:text-gray-300">{user!.name}</span> · {user!.role}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex-1 py-2.5 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed ${
              isException
                ? 'bg-amber-500 hover:bg-amber-400 text-white'
                : 'bg-blue-500 hover:bg-blue-400 text-white'
            }`}
          >
            {submitting ? 'Approving…' : 'Approve Release'}
          </button>
        </div>
      </form>
    </div>
  );
}
