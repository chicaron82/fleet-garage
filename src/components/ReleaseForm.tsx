import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';

interface Props {
  holdId: string;
  vehicleId: string;
  onClose: () => void;
}

const RELEASE_REASONS = [
  'Damage documented — vehicle serviceable for rental',
  'Awaiting parts — vehicle cleared for limited use',
  'Customer accepted known damage',
  'Repair appointment scheduled',
  'Insurance claim filed — vehicle cleared',
  'Management decision — operational need',
];

export function ReleaseForm({ holdId, vehicleId: _vehicleId, onClose }: Props) {
  const { user } = useAuth();
  const { addRelease } = useGarage();

  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finalReason = reason === '__custom__' ? customReason.trim() : reason;
  const canSubmit = finalReason && expectedReturn && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await addRelease(holdId, {
        holdId,
        approvedById: user!.id,
        approvedAt: new Date().toISOString(),
        reason: finalReason,
        expectedReturn,
        notes,
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div className="bg-amber-50 px-5 py-4 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-amber-900 text-sm">Approve Release</h3>
            <p className="text-xs text-amber-700 mt-0.5">Vehicle will move to Out on Exception status</p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-400 hover:text-amber-700 transition text-lg leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* Release Reason */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
            Reason for Release *
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition bg-white"
          >
            <option value="">Select a reason…</option>
            {RELEASE_REASONS.map(r => (
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
              className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
            />
          )}
        </div>

        {/* Expected Return Date */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
            Expected Return Date *
          </label>
          <input
            type="date"
            value={expectedReturn}
            onChange={e => setExpectedReturn(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
          />
        </div>

        {/* Manager Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Additional context for the record…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Approver info */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500">
          Approving as <span className="font-medium text-gray-700">{user!.name}</span> · {user!.role}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Approving…' : 'Approve Release'}
          </button>
        </div>
      </form>
    </div>
  );
}
