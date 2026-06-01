import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight, hapticMedium, hapticHeavy } from '../../lib/haptics';
import { reasonsFor } from './releaseReasons';
import { releaseTypeTheme } from './releaseTheme';
import { ReleaseConfirmPanel } from './ReleaseConfirmPanel';
import type { ReleaseType } from '../../types';

interface Props {
  holdId: string;
  vehicleId: string;
  onClose: () => void;
  streak?: number;
}

export function ReleaseForm({ holdId, vehicleId, onClose, streak }: Props) {
  const { user } = useAuth();
  const { addRelease, holds, vehicles } = useVehicleHoldContext();

  const hold    = holds.find(h => h.id === holdId);
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const isDetailHold  = hold?.holdType === 'detail';
  const isSaleCarHold = hold?.holdType === 'sale_car';

  const [releaseType, setReleaseType] = useState<ReleaseType>('EXCEPTION');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isException  = releaseType === 'EXCEPTION';
  const isMechanical = releaseType === 'MECHANICAL_RELEASE';
  const isPre        = releaseType === 'PRE_EXISTING';
  const theme        = releaseTypeTheme(releaseType);

  const reasons = reasonsFor(releaseType, { isSaleCarHold, isDetailHold });

  const finalReason = reason === '__custom__' ? customReason.trim() : reason;
  const needsReturn = isException || isMechanical;
  const canSubmit = !!finalReason && !submitting;

  const handleTypeChange = (t: ReleaseType) => {
    hapticLight();
    setReleaseType(t);
    setReason('');
    setCustomReason('');
    if (t === 'PRE_EXISTING') setExpectedReturn('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    hapticMedium();
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addRelease(holdId, {
        holdId,
        approvedById: user!.id,
        approvedAt: new Date().toISOString(),
        releaseType,
        releaseMethod: 'standard',
        reason: finalReason,
        expectedReturn: needsReturn && expectedReturn.trim() ? expectedReturn : undefined,
        notes,
      });
      hapticHeavy();
      onClose();
    } catch (err) {
      hapticHeavy();
      setSubmitError(err instanceof Error ? err.message : 'Failed to approve release — try again.');
      setSubmitting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <ReleaseConfirmPanel
        releaseType={releaseType}
        vehicle={vehicle}
        hold={hold}
        expectedReturn={expectedReturn}
        finalReason={finalReason}
        notes={notes}
        userName={user!.name}
        userRole={user!.role}
        submitting={submitting}
        submitError={submitError}
        onBack={() => setConfirming(false)}
        onConfirm={handleConfirm}
      />
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 transition-colors rounded-xl border overflow-hidden ${theme.border}`}>
      <div className={`px-5 py-4 border-b ${theme.header}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-sm ${theme.title}`}>
              Approve Release
            </h3>
            <p className={`text-xs mt-0.5 ${theme.subtitle}`}>
              {theme.headerDescription}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`transition text-lg leading-none cursor-pointer ${theme.close}`}
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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('EXCEPTION')}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                isException
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'
              }`}
            >
              <span className="block text-sm font-semibold">Exception</span>
              <span className="block text-xs opacity-70 mt-0.5">Temporary — return date optional</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('MECHANICAL_RELEASE')}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                isMechanical
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'
              }`}
            >
              <span className="block text-sm font-semibold">Mechanical</span>
              <span className="block text-xs opacity-70 mt-0.5">Short term — return for service</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('PRE_EXISTING')}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                isPre
                  ? 'border-blue-400 bg-blue-50 text-blue-900'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'
              }`}
            >
              <span className="block text-sm font-semibold">Pre-existing</span>
              <span className="block text-xs opacity-70 mt-0.5">Renting as-is — no repair planned</span>
            </button>
          </div>
        </div>

        {/* Streak-based Pre-existing suggestion */}
        {streak !== undefined && streak >= 2 && releaseType !== 'PRE_EXISTING' && (
          <div className={`rounded-lg border px-4 py-3 ${
            streak >= 3
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold mb-0.5 ${
                  streak >= 3
                    ? 'text-red-800 dark:text-red-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {streak >= 3 ? '🔴' : '⚠️'} Released {streak}× without repair
                </p>
                <p className={`text-xs ${
                  streak >= 3
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {streak >= 3
                    ? "This damage isn't getting fixed. Pre-existing may be the more honest status."
                    : 'This vehicle keeps going out with the same issue. Consider marking as Pre-existing instead.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTypeChange('PRE_EXISTING')}
                className={`shrink-0 text-xs font-medium underline transition cursor-pointer ${
                  streak >= 3
                    ? 'text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200'
                    : 'text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200'
                }`}
              >
                Switch →
              </button>
            </div>
          </div>
        )}

        {/* Release Reason */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Reason *
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition bg-white dark:bg-gray-900 ${theme.focusRing}`}
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
              className={`mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${theme.focusRing}`}
            />
          )}
        </div>

        {/* Expected Return Date — EXCEPTION and MECHANICAL_RELEASE */}
        {needsReturn && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
              Expected Return Date <span className="normal-case font-normal text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <input
              type="date"
              value={expectedReturn}
              onChange={e => setExpectedReturn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition ${theme.focusRing}`}
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
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none ${theme.focusRing}`}
          />
        </div>

        {/* Approver info */}
        <div className="bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          Approving as <span className="font-medium text-gray-700 dark:text-gray-300">{user!.name}</span> · {user!.role}
        </div>

        {/* Submit error */}
        {submitError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

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
            className={`flex-1 py-2.5 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed ${theme.submit}`}
          >
            {submitting ? 'Approving…' : 'Approve Release'}
          </button>
        </div>
      </form>
    </div>
  );
}
