import type { Hold } from '../types';

interface Props {
  hold: Hold;
  getName: (userId: string) => string;
  getRole: (userId: string) => string;
  getEmpId: (userId: string) => string;
  fmt: (iso: string) => string;
  fmtDate: (iso: string) => string;
}

export function HoldRecordFooter({ hold, getName, getRole, getEmpId, fmt, fmtDate }: Props) {
  return (
    <>
      {hold.release && (() => {
        const isPre = hold.release.releaseType === 'PRE_EXISTING';
        return (
          <div className={`p-4 border-t ${isPre ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 dark:bg-amber-900/30 border-amber-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isPre ? 'text-blue-800' : 'text-amber-800'}`}>
              {isPre ? 'Pre-existing — Cleared for Rental' : 'Release Approval'}
            </p>
            <p className={`text-xs ${isPre ? 'text-blue-900' : 'text-amber-900'}`}>
              Approved by <span className="font-semibold">{getName(hold.release.approvedById)}</span>
              {' '}· {getEmpId(hold.release.approvedById)} ({getRole(hold.release.approvedById)}) · {fmt(hold.release.approvedAt)}
            </p>
            <p className={`text-xs mt-1 ${isPre ? 'text-blue-700' : 'text-amber-700 dark:text-amber-400'}`}>
              Reason: {hold.release.reason}
            </p>
            {hold.release.expectedReturn && (
              <p className={`text-xs mt-0.5 ${isPre ? 'text-blue-700' : 'text-amber-700 dark:text-amber-400'}`}>
                Expected return: {fmtDate(hold.release.expectedReturn)}
                {hold.release.actualReturn && (
                  <> · Returned: {fmtDate(hold.release.actualReturn)}</>
                )}
              </p>
            )}
            {isPre && !hold.release.expectedReturn && (
              <p className="text-xs text-blue-600 mt-0.5">No repair planned — renting as-is</p>
            )}
            {hold.release.notes && (
              <p className={`text-xs mt-1 italic ${isPre ? 'text-blue-600' : 'text-amber-600'}`}>
                "{hold.release.notes}"
              </p>
            )}
          </div>
        );
      })()}
      {hold.repair && (
        <div className="p-4 border-t bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-green-800 dark:text-green-300">
            ✓ Damage Repaired
          </p>
          <p className="text-xs text-green-900 dark:text-green-200">
            Confirmed by <span className="font-semibold">{getName(hold.repair.repairedById)}</span>
            {' '}· {getEmpId(hold.repair.repairedById)} ({getRole(hold.repair.repairedById)}) · {fmt(hold.repair.repairedAt)}
          </p>
          {hold.repair.notes && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-1 italic">"{hold.repair.notes}"</p>
          )}
        </div>
      )}
    </>
  );
}
