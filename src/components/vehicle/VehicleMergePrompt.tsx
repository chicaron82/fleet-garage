import type { VehicleRegistryEntry } from '../../types';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface Props {
  plate?:      string | null;
  unitNumber?: string | null;
  existing:    VehicleRegistryEntry;
  onMerge:     () => void;
  onCreateNew: () => void;
}

export function VehicleMergePrompt({ plate, unitNumber, existing, onMerge, onCreateNew }: Props) {
  const knownId     = existing.plate      ? `plate ${existing.plate}`
                    : existing.unitNumber ? `unit ${existing.unitNumber}`
                    : 'an earlier record';
  const incomingId  = plate       ? `plate ${plate}`
                    : unitNumber  ? `unit ${unitNumber}`
                    : 'a new identifier';
  const arrivedText = existing.arrivedAt ? `Checked in at ${fmtTime(existing.arrivedAt)}` : 'Logged earlier today';

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Possible match found
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          A record with {knownId} exists — {arrivedText}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          Is this the same vehicle as {incomingId}?
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onMerge}
          className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2 transition-colors"
        >
          Yes, merge
        </button>
        <button
          onClick={onCreateNew}
          className="flex-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-sm font-semibold py-2 transition-colors"
        >
          No, create new
        </button>
      </div>
    </div>
  );
}
