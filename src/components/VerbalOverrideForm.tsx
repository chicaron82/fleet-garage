import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { hapticMedium, hapticHeavy } from '../lib/haptics';

interface Props {
  holdId: string;
  onClose: () => void;
}

export function VerbalOverrideForm({ holdId, onClose }: Props) {
  const { user } = useAuth();
  const { addRelease } = useGarage();

  const [managerName, setManagerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = managerName.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await addRelease(holdId, {
        holdId,
        approvedById: user!.id,
        approvedAt: new Date().toISOString(),
        releaseType: 'EXCEPTION',
        releaseMethod: 'verbal_override',
        overrideAuthorization: managerName.trim(),
        reason: `Verbal override — authorized by ${managerName.trim()}`,
        notes,
      });
      hapticMedium();
      onClose();
    } catch {
      hapticHeavy();
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 transition-colors rounded-xl border border-orange-200 dark:border-orange-800/50 overflow-hidden">
      <div className="px-5 py-4 border-b bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30">
        <h3 className="font-semibold text-sm text-orange-900 dark:text-orange-300">
          Log Verbal Override
        </h3>
        <p className="text-xs mt-0.5 text-orange-700 dark:text-orange-400">
          Record a manager's verbal instruction to release this vehicle
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Manager Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Authorizing Manager *
          </label>
          <input
            type="text"
            placeholder="Manager name…"
            value={managerName}
            onChange={e => setManagerName(e.target.value)}
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            This records who gave the verbal instruction. It will be marked as unverified.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Notes / Context (optional)
          </label>
          <textarea
            rows={2}
            placeholder="Circumstances, time of instruction…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Executor info */}
        <div className="bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          Logging as <span className="font-medium text-gray-700 dark:text-gray-300">{user!.name}</span> · {user!.employeeId} ({user!.role})
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Logging…' : 'Log Override'}
          </button>
        </div>
      </form>
    </div>
  );
}
