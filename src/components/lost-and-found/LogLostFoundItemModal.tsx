// The Log-Found-Item sheet — a thin two-step shell. All form state + handlers live
// in useLostFoundItemForm; each step is its own section component (photos / details).
// Split out of a single 330-cap file (docs/ticket-near-cap-file-extractions.md).
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useLostFoundItemForm } from '../../hooks/useLostFoundItemForm';
import type { LostFoundLocation, User } from '../../types';
import { LostFoundPhotoStep } from './LostFoundPhotoStep';
import { LostFoundDetailsStep } from './LostFoundDetailsStep';

interface LogLostFoundItemModalProps {
  user: User | null;
  /** Plate to start with — the scan-router hands the scanned tag's plate straight in. */
  initialPlate?: string;
  /** Bumped per scan so re-scanning the same tag re-seeds the plate (see Screen.prefillNonce). */
  initialPlateNonce?: number;
  onClose: () => void;
  onSubmit: (item: {
    keyTagPhoto?: string;
    itemPhoto?: string;
    description?: string;
    location?: LostFoundLocation;
    licensePlate?: string;
    notes?: string;
  }) => Promise<boolean>;
}

export function LogLostFoundItemModal({ user, initialPlate, initialPlateNonce, onClose, onSubmit }: LogLostFoundItemModalProps) {
  useEscapeKey(onClose);
  const form = useLostFoundItemForm({ initialPlate, initialPlateNonce, onSubmit, onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl transition-colors max-h-[90dvh] overflow-y-auto">
        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors">
            Log Found Item — Step {form.step} of 2
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          {form.step === 1 ? <LostFoundPhotoStep form={form} /> : <LostFoundDetailsStep form={form} user={user} />}
        </div>
      </div>
    </div>
  );
}
