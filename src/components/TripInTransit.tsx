import { NotesField, fmtTime } from '../lib/vsa-trip';
import type { VSALocation, Authorization } from '../lib/vsa-trip';

export function TripInTransit({ plate, vehicleMeta, from, to, authorization, departureTime, elapsed, notes, setNotes, onArrived }: {
  plate: string; vehicleMeta: string | null;
  from: VSALocation; to: VSALocation;
  authorization: Authorization | null;
  departureTime: string; elapsed: string;
  notes: string; setNotes: (v: string) => void;
  onArrived: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-4 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">In Transit</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{plate}</p>
            {vehicleMeta && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vehicleMeta.split(' · ')[0]}</p>}
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 font-medium">{from} → {to}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {authorization === 'MANAGEMENT' ? 'Management Decision' : authorization === 'LEAD_VSA' ? 'Lead VSA Authorization' : 'Personal — Proactive'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Departed {fmtTime(departureTime)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">{elapsed || '0m 00s'}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">elapsed</p>
          </div>
        </div>
      </div>
      <NotesField value={notes} onChange={setNotes} tripState="in_transit" />
      <button
        type="button" onClick={onArrived}
        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        ✓ Arrived at Destination
      </button>
    </div>
  );
}
