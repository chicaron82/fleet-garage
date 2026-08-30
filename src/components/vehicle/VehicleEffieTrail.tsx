import { useState } from 'react';
import { useVehicleEffieWrites } from '../../hooks/useVehicleEffieWrites';
import { useProfiles } from '../../context/ProfilesContext';
import { describeEffieWrite } from '../../lib/effieVehicleTrail';
import { describeChangeTime } from '../../lib/vehicleChanges';
import { hapticLight } from '../../lib/haptics';

// What EFFIE did to this record, and who let her — the half `VehicleChangeLog` is honest about not
// knowing. That component's header says it plainly: *"It never says WHO. FG writes with the anon key
// under allow-all RLS, so no honest actor exists to name."* Here one does: a proposal has a
// `proposed_by` and an approver has a `resolved_by`, both real profile ids.
//
// Same grammar as the change log it sits under — collapsed, muted, and SILENT WHEN EMPTY. Almost
// every car has nothing here (12 resolved writes across the whole fleet), and an empty box on every
// vehicle screen trains him to scroll past the one car that eventually does have something.
//
// ⚠️ No count badge, on purpose. The global version of this list wore the same pill as the two
// actionable queues beside it and Aaron read it as work: *"having a badge persist at 12 reads as if
// i still need to do something with them"*. Shape is what carried that, not colour, so this surface
// does not get a number at all.
export function VehicleEffieTrail({ vehicleId, licensePlate }: { vehicleId: string; licensePlate: string }) {
  const rows = useVehicleEffieWrites(vehicleId, licensePlate);
  const profiles = useProfiles();
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  const name = (id: string | null) => (id ? profiles.get(id)?.name ?? '—' : '—');
  const label = rows.length === 1 ? 'Effie wrote to this record once' : `Effie wrote to this record ${rows.length} times`;

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(o => !o); }}
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
      >
        <span>🤖 {label}</span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {rows.map(r => (
            <li key={r.id} className="text-xs">
              <div className="text-gray-400 dark:text-gray-500">
                {describeChangeTime(r.createdAt)}
                <span className="ml-1">· via {r.source}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="font-semibold">{describeEffieWrite(r)}</span>
                {/* Rejected rows are kept and marked rather than hidden. "Effie proposed this and a
                    human said no" is a real answer to "why doesn't the record say that", and
                    dropping it would leave the question looking unanswered. */}
                {r.status === 'rejected'
                  ? <span className="text-red-600 dark:text-red-400 font-semibold">· rejected</span>
                  : <span className="text-green-700 dark:text-green-400">· approved</span>}
              </div>
              <div className="text-gray-400 dark:text-gray-500">
                proposed by {name(r.proposedBy)} · {r.status === 'rejected' ? 'rejected' : 'approved'} by {name(r.resolvedBy)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
