import { useState } from 'react';
import type { FleetAuditFinding } from '../../lib/fleetAudit';
import { auditSummary, describeAuditVehicle } from '../../lib/fleetAudit';
import { hapticLight } from '../../lib/haptics';
import type { Screen } from '../../types';

// "Needs a look" — contradictions in the fleet's own records (2026-08-19, Aaron's ask after finding
// two duplicate vehicles by hand).
//
// ⭐ IT PROPOSES, IT NEVER FIXES. Every row names the records and offers exactly two moves: open one
// to deal with it, or say it's fine. No merge button, no auto-resolution — a wrong auto-merge would
// eat a damage record, which is the single thing FG exists to prevent.
//
// Silent when clean, collapsed when not. The whole surface should feel like a smoke alarm: unnoticed
// almost always, and unmissable the day it matters.
export function FleetAuditPanel({ findings, loaded, onDismiss, onNavigate }: {
  findings: FleetAuditFinding[];
  loaded: boolean;
  onDismiss: (key: string) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!loaded || findings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer"
      >
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          🔍 {auditSummary(findings)}
        </span>
        <span className="text-xs text-amber-600 dark:text-amber-400">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {findings.map(f => (
            <div key={f.key} className="rounded-lg bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/40 px-3 py-2.5 space-y-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{f.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{f.detail}</p>

              <div className="space-y-1">
                {f.vehicles.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onNavigate({ name: 'vehicle', vehicleId: v.id })}
                    className="block w-full text-left text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
                  >
                    {describeAuditVehicle(v)}
                  </button>
                ))}
              </div>

              {/* The escape hatch that keeps the list readable. Some findings are simply TRUE and
                  can't be fixed from here — without this they'd sit forever and teach him to skim. */}
              <button
                type="button"
                onClick={() => { hapticLight(); onDismiss(f.key); }}
                className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
              >
                These are fine — don't flag again
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
