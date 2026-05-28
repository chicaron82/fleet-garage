import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight, hapticMedium, hapticHeavy } from '../../lib/haptics';
import type { ReleaseType } from '../../types';

interface Props {
  holdId: string;
  vehicleId: string;
  onClose: () => void;
  streak?: number;
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

const SALE_CAR_RELEASE_REASONS = [
  'Auction — short term circulation',
  'Released — auction not yet scheduled',
];

const MECHANICAL_RELEASE_REASONS = [
  'PM due — releasing short term, service within 2 days',
  'PM due — releasing short term, service within 1 week',
  'Low tread — short term, return before next rental cycle',
  'Minor mechanical — acceptable for short term use',
  'Fleet shortage — releasing pending next available service slot',
  'Management decision — operational need',
];

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

  const reasons = isMechanical
    ? MECHANICAL_RELEASE_REASONS
    : isException
      ? (isSaleCarHold ? SALE_CAR_RELEASE_REASONS : isDetailHold ? DETAIL_EXCEPTION_REASONS : EXCEPTION_REASONS)
      : PRE_EXISTING_REASONS;

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

  const borderClass =
    isException  ? 'border-amber-200 dark:border-amber-800/50' :
    isMechanical ? 'border-orange-200 dark:border-orange-800/50' :
                   'border-blue-200';

  const headerClass =
    isException  ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-100' :
    isMechanical ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-100' :
                   'bg-blue-50 border-blue-100';

  const titleClass =
    isException  ? 'text-amber-900' :
    isMechanical ? 'text-orange-900 dark:text-orange-100' :
                   'text-blue-900';

  const subtitleClass =
    isException  ? 'text-amber-700 dark:text-amber-400' :
    isMechanical ? 'text-orange-700 dark:text-orange-400' :
                   'text-blue-700';

  const closeClass =
    isException  ? 'text-amber-400 hover:text-amber-700 dark:text-amber-400' :
    isMechanical ? 'text-orange-400 hover:text-orange-700 dark:text-orange-400' :
                   'text-blue-400 hover:text-blue-700';

  const focusRing =
    isException  ? 'focus:ring-amber-400' :
    isMechanical ? 'focus:ring-orange-400' :
                   'focus:ring-blue-400';

  const submitClass =
    isException  ? 'bg-amber-500 hover:bg-amber-400 text-white' :
    isMechanical ? 'bg-orange-500 hover:bg-orange-400 text-white' :
                   'bg-blue-500 hover:bg-blue-400 text-white';

  const headerDescription =
    isException  ? 'Vehicle will move to Out on Exception status' :
    isMechanical ? 'Mechanical hold — short term, must return for service' :
                   'Vehicle will be marked Pre-existing — renting as-is';

  const releaseTypeLabel =
    isException  ? 'Exception' :
    isMechanical ? 'Mechanical Release' :
                   'Pre-existing';

  if (confirming) {
    return (
      <div className={`bg-white dark:bg-gray-900 transition-colors rounded-xl border overflow-hidden ${borderClass}`}>
        <div className={`px-5 py-4 border-b ${headerClass}`}>
          <h3 className={`font-semibold text-sm ${titleClass}`}>Confirm Release</h3>
          <p className={`text-xs mt-0.5 ${subtitleClass}`}>
            This vehicle has documented damage and will go out on the lot.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {vehicle && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Vehicle</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {vehicle.unitNumber} · {vehicle.licensePlate}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}
              </p>
            </div>
          )}

          {hold?.damageDescription && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Damage</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{hold.damageDescription}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Release Type</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{releaseTypeLabel}</p>
            </div>
            {expectedReturn && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Expected Return</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{expectedReturn}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Reason</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{finalReason}</p>
          </div>

          {notes.trim() && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{notes}</p>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
            Approving as <span className="font-medium text-gray-700 dark:text-gray-300">{user!.name}</span> · {user!.role}
          </div>

          {submitError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className={`flex-1 py-2.5 font-semibold text-sm rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${submitClass}`}
            >
              {submitting ? 'Releasing…' : 'Confirm — Release Vehicle'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 transition-colors rounded-xl border overflow-hidden ${borderClass}`}>
      <div className={`px-5 py-4 border-b ${headerClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold text-sm ${titleClass}`}>
              Approve Release
            </h3>
            <p className={`text-xs mt-0.5 ${subtitleClass}`}>
              {headerDescription}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`transition text-lg leading-none cursor-pointer ${closeClass}`}
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
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition bg-white dark:bg-gray-900 ${focusRing}`}
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
              className={`mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${focusRing}`}
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
              className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent transition ${focusRing}`}
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
            className={`w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none ${focusRing}`}
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
            className={`flex-1 py-2.5 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed ${submitClass}`}
          >
            {submitting ? 'Approving…' : 'Approve Release'}
          </button>
        </div>
      </form>
    </div>
  );
}
