import { hapticLight } from '../../lib/haptics';
import { REPAIR_OUTCOME_LABELS } from '../../types';
import type { Hold, RepairOutcome } from '../../types';

interface RepairConfirmSectionProps {
  holds: Hold[];
  repairNotes: string;
  setRepairNotes: (notes: string) => void;
  repairOutcome: RepairOutcome;
  setRepairOutcome: (outcome: RepairOutcome) => void;
  repairing: boolean;
  error?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function holdActionLabel(holdTypes: string[]): string {
  if (holdTypes.some((t) => t === 'detail' || t === 'mechanical')) {
    return 'Mark as Done';
  }
  return 'Mark as Repaired';
}

function holdConfirmBody(holdTypes: string[]): string {
  if (holdTypes.includes('detail')) return 'This marks the detail work as complete.';
  if (holdTypes.includes('mechanical')) return 'This marks the service as complete.';
  return 'This marks the damage as fully repaired.';
}

export function RepairConfirmSection({
  holds,
  repairNotes,
  setRepairNotes,
  repairOutcome,
  setRepairOutcome,
  repairing,
  error,
  onCancel,
  onConfirm,
}: RepairConfirmSectionProps) {
  if (holds.length === 0) return null;
  const count = holds.length;
  const actionLabel = count > 1 ? `Mark ${count} as Done` : holdActionLabel(holds[0].holdTypes);

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40 p-5 space-y-4">
      <h2 className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-widest">
        Confirm
      </h2>
      <p className="text-sm text-green-900 dark:text-green-200">
        {count > 1 ? (
          <>Resolves <strong>{count} holds</strong> on this vehicle (same notes &amp; outcome for all). Its status updates to the result once they're marked done.</>
        ) : (
          <>{holdConfirmBody(holds[0].holdTypes)} The vehicle will be set to <strong>Clear</strong> and returned to service.</>
        )}
      </p>
      <div>
        <label className="block text-xs font-medium text-green-800 dark:text-green-300 mb-1.5 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Repair details, shop, completion date…"
          value={repairNotes}
          onChange={(e) => setRepairNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-green-300 dark:border-green-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">
          Repair outcome
        </p>
        <div className="flex gap-2">
          {(['clean', 'scar-remains'] as RepairOutcome[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                hapticLight();
                setRepairOutcome(o);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                repairOutcome === o
                  ? o === 'clean'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {REPAIR_OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Couldn't save — please try again.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium text-sm rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={repairing}
          onClick={onConfirm}
          className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          {repairing ? 'Saving…' : actionLabel}
        </button>
      </div>
    </div>
  );
}
