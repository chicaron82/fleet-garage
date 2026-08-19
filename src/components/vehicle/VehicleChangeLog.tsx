import { useState } from 'react';
import { useVehicleChanges } from '../../hooks/useVehicleChanges';
import { changeLines, describeChangeTime, changeCountLabel } from '../../lib/vehicleChanges';
import { hapticLight } from '../../lib/haptics';

// What this record has been edited to, and when (migrations/118).
//
// Collapsed by default and silent when empty. The trail starts on 2026-08-18, so almost every car
// has nothing here — and an empty section shouting at him on every vehicle screen would teach him
// to scroll past the one car that eventually does have something.
//
// ⚠️ It never says WHO. FG writes with the anon key under allow-all RLS, so no honest actor exists
// to name (project_fg_scope_boundary). Better a trail that admits what it doesn't know than one
// that quietly implies a person.
export function VehicleChangeLog({ vehicleId }: { vehicleId: string }) {
  const rows = useVehicleChanges(vehicleId);
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
      >
        <span>🕓 {changeCountLabel(rows)}</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {rows.map((row, i) => {
            const lines = changeLines(row);
            if (lines.length === 0) return null;
            return (
              <li key={`${row.changedAt}-${i}`} className="text-xs">
                <div className="text-gray-400 dark:text-gray-500">
                  {describeChangeTime(row.changedAt)}
                  {row.op === 'DELETE' && <span className="ml-1 text-red-500 font-semibold">· record deleted</span>}
                </div>
                {lines.map(l => (
                  <div key={l.field} className="flex flex-wrap items-baseline gap-1.5 text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">{l.label}</span>
                    {/* No strikethrough. The arrow already says "became", and on short values the
                        line renders as a glyph rather than a deletion — a struck "1" reads as "+",
                        a struck em dash reads as anything but empty. Both showed up on the verify
                        shot. Muted-vs-solid carries the same meaning without inventing symbols. */}
                    <span className="opacity-50">{l.from}</span>
                    <span className="opacity-60">→</span>
                    <span className="font-mono">{l.to}</span>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
