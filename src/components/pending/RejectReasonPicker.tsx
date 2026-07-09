// The reason chips shown in place of a staged write's card when the operator taps Reject
// — the capture half of the correction loop (docs/ticket-misc-effie-correction-loop.md).
// Picking a reason rejects WITH that signal; "Skip" rejects with none (never blocking);
// "Cancel" returns to the card. Pure props — the reject write lives in PendingWritesSection.
import { REJECT_REASONS } from '../../lib/rejectReasons';

export function RejectReasonPicker({ onPick, onCancel }: {
  /** Reject the row — with a reason id, or undefined for a plain (skipped) reject. */
  onPick: (reasonId?: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-white dark:bg-gray-900 p-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Why reject?</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Helps Effie learn where she misfires.</p>
      <div className="flex flex-wrap gap-1.5">
        {REJECT_REASONS.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            className="rounded-full border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition cursor-pointer"
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button type="button" onClick={() => onPick(undefined)} className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer">
          Reject — skip reason
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 dark:text-gray-500 hover:underline cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}
