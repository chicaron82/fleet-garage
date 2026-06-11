import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { canRelease } from '../../types';
import type { Hold, UserRole } from '../../types';
import { hapticMedium } from '../../lib/haptics';

interface Props {
  holds: Hold[];
  role: UserRole;
}

// Management action to close a stale / orphaned OPEN exception — one the issue
// was resolved another way (repaired separately), or that belongs to a duplicate
// hold — that's keeping a vehicle stuck On-Exception with no normal path to clear
// it. Self-contained so the vehicle-history view stays under its line cap.
// Sale-car exceptions are excluded: those clear via "Clear sale flag" instead.
export function CloseExceptionAction({ holds, role }: Props) {
  const { user } = useAuth();
  const { closeException } = useVehicleHoldContext();
  const [confirm, setConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError]   = useState(false);

  const target = holds.find(h =>
    h.status === 'RELEASED' &&
    h.release?.releaseType === 'EXCEPTION' &&
    !h.release?.actualReturn &&
    !h.holdTypes.includes('sale_car')
  );

  // Closing an exception is the inverse of releasing one — a management liability
  // call, so it's gated to canRelease.
  if (!canRelease(role) || !target || !user) return null;

  const handleClose = async () => {
    setClosing(true);
    setError(false);
    try {
      await closeException(target.id, user.name);
      hapticMedium();
      setConfirm(false);
    } catch {
      setError(true);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="mt-2">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition cursor-pointer"
        >
          ⚠️ Close exception — resolved without return
        </button>
      ) : (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Close this open exception?</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Use only when the exception is already resolved — repaired separately, or logged in error. The unit returns to its derived status (no re-evaluation), and management is notified.
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Couldn't close it — try again.</p>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              disabled={closing}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              {closing ? 'Closing…' : 'Close exception'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
