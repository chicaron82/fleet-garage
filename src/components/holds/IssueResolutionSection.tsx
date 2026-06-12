import { useState } from 'react';
import { RepairConfirmSection } from './RepairConfirmSection';
import { HOLD_TYPE_LABELS } from '../../lib/holdTypeLabels';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import type { Hold, HoldType, Repair, RepairOutcome } from '../../types';

interface IssueResolutionSectionProps {
  hold: Hold;
  userId: string;
  markIssueRepaired: (holdId: string, type: HoldType, repair?: Omit<Repair, 'id'>) => Promise<void>;
  onDone: () => void;
}

/** Per-issue resolution for a multi-type hold: mark each issue done as it's fixed.
 *  Intermediate issues resolve instantly (the hold stays held); the LAST remaining
 *  issue collects notes/outcome via the existing confirm form, then the whole hold
 *  flips to REPAIRED and the vehicle clears. */
export function IssueResolutionSection({ hold, userId, markIssueRepaired, onDone }: IssueResolutionSectionProps) {
  const [pendingFinal, setPendingFinal] = useState<HoldType | null>(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<RepairOutcome>('clean');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const unresolved = hold.holdTypes.filter(t => !hold.resolvedTypes.includes(t));

  const markDone = async (type: HoldType) => {
    // The last remaining issue flips the whole hold → collect notes/outcome first.
    if (unresolved.length === 1 && unresolved[0] === type) {
      setPendingFinal(type);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await markIssueRepaired(hold.id, type);
      hapticLight();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmFinal = async () => {
    if (!pendingFinal) return;
    setBusy(true);
    setError(false);
    try {
      await markIssueRepaired(hold.id, pendingFinal, {
        holdId: hold.id, repairedById: userId,
        repairedAt: new Date().toISOString(), notes: notes.trim(), outcome,
      });
      hapticMedium();
      onDone();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  // Final issue → reuse the existing confirm form (notes + outcome).
  if (pendingFinal) {
    return (
      <RepairConfirmSection
        holds={[hold]}
        repairNotes={notes}
        setRepairNotes={setNotes}
        repairOutcome={outcome}
        setRepairOutcome={setOutcome}
        repairing={busy}
        error={error}
        onCancel={() => setPendingFinal(null)}
        onConfirm={confirmFinal}
      />
    );
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40 p-5 space-y-3">
      <h2 className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-widest">Resolve issues</h2>
      <p className="text-sm text-green-900 dark:text-green-200">
        This hold covers <strong>{hold.holdTypes.length} issues</strong>. Mark each done as it's fixed — the vehicle stays held until the last one clears.
      </p>
      <div className="space-y-2">
        {hold.holdTypes.map(type => {
          const resolved = hold.resolvedTypes.includes(type);
          return (
            <div key={type} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 rounded-lg border border-green-200 dark:border-green-800/40 px-3.5 py-2.5">
              <span className={`text-sm font-medium ${resolved ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {resolved ? '✓ ' : ''}{HOLD_TYPE_LABELS[type]}
              </span>
              {resolved ? (
                <span className="text-xs text-green-600 dark:text-green-500 font-semibold">Done</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => markDone(type)}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Mark done
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">Couldn't save — please try again.</p>}
      <button
        type="button"
        onClick={onDone}
        className="w-full py-2 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium text-sm rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition cursor-pointer"
      >
        Close
      </button>
    </div>
  );
}
