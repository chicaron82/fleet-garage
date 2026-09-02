import type { ReleaseType, Vehicle, Hold } from '../../types';
import { VehicleName } from '../shared/VehicleName';
import { releaseTypeTheme } from './releaseTheme';

interface Props {
  releaseType: ReleaseType;
  vehicle?: Vehicle;
  hold?: Hold;
  expectedReturn: string;
  finalReason: string;
  notes: string;
  userName: string;
  userRole: string;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

export function ReleaseConfirmPanel({
  releaseType, vehicle, hold, expectedReturn, finalReason, notes,
  userName, userRole, submitting, submitError, onBack, onConfirm,
}: Props) {
  const theme = releaseTypeTheme(releaseType);

  return (
    <div className={`bg-white dark:bg-gray-900 transition-colors rounded-xl border overflow-hidden ${theme.border}`}>
      <div className={`px-5 py-4 border-b ${theme.header}`}>
        <h3 className={`font-semibold text-sm ${theme.title}`}>Confirm Release</h3>
        <p className={`text-xs mt-0.5 ${theme.subtitle}`}>
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
              <VehicleName vehicle={vehicle} /> · {vehicle.color}
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
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{theme.label}</p>
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
          Approving as <span className="font-medium text-gray-700 dark:text-gray-300">{userName}</span> · {userRole}
        </div>

        {submitError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-1 py-2.5 font-semibold text-sm rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${theme.submit}`}
          >
            {submitting ? 'Releasing…' : 'Confirm — Release Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}
