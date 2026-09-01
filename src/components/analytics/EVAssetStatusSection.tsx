import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { BranchId } from '../../types';

interface TeslaVehicle {
  id: string;
  unitNumber: string;
  licensePlate: string;
}

interface EVTripRecord {
  vehiclePlate: string;
  cableStatus: 'present' | 'missing';
  adapterStatus: 'present' | 'missing';
  departTime: string;
}

interface TeslaRow {
  vehicle: TeslaVehicle;
  latest: EVTripRecord | null;
}

function statusLabel(r: EVTripRecord): { text: string; color: string } {
  const cableOk   = r.cableStatus   === 'present';
  const adapterOk = r.adapterStatus === 'present';
  if (cableOk && adapterOk)   return { text: 'Complete',              color: 'text-green-600 dark:text-green-400' };
  if (!cableOk && !adapterOk) return { text: 'Both missing',          color: 'text-red-600 dark:text-red-400' };
  if (!cableOk)               return { text: 'Cable missing',         color: 'text-amber-600 dark:text-amber-400' };
                               return { text: 'Adapter missing',      color: 'text-amber-600 dark:text-amber-400' };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

interface Props {
  activeBranch: BranchId | 'ALL';
}

export function EVAssetStatusSection({ activeBranch }: Props) {
  const [rows, setRows] = useState<TeslaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1. All registered Teslas
      let vehicleQuery = supabase
        .from('vehicles')
        .select('id, unit_number, license_plate')
        .ilike('make', 'tesla');
      if (activeBranch !== 'ALL') vehicleQuery = vehicleQuery.eq('branch_id', activeBranch);
      const { data: vehicleData } = await vehicleQuery;

      const teslas: TeslaVehicle[] = (vehicleData ?? []).map(r => ({
        id:           r.id as string,
        unitNumber:   r.unit_number as string,
        licensePlate: r.license_plate as string,
      }));

      if (!teslas.length) { setRows([]); setLoading(false); return; }

      // 2. Most recent EV-logged trip per plate — all in one query, dedup in JS
      const plates = teslas.map(t => t.licensePlate);
      const { data: tripData } = await supabase
        .from('vsa_trips')
        .select('vehicle_plate, ev_cable_status, ev_adapter_status, depart_time')
        .is('voided_at', null)   // a voided send did not happen
        .in('vehicle_plate', plates)
        .not('ev_cable_status', 'is', null)
        .order('depart_time', { ascending: false });

      // Latest trip per plate
      const latestByPlate = new Map<string, EVTripRecord>();
      for (const t of (tripData ?? [])) {
        const plate = (t.vehicle_plate as string).toUpperCase();
        if (!latestByPlate.has(plate)) {
          latestByPlate.set(plate, {
            vehiclePlate:  plate,
            cableStatus:   t.ev_cable_status   as 'present' | 'missing',
            adapterStatus: t.ev_adapter_status as 'present' | 'missing',
            departTime:    t.depart_time as string,
          });
        }
      }

      // Sort: issues first (missing), then complete, then no data
      const sorted = teslas
        .map(vehicle => ({
          vehicle,
          latest: latestByPlate.get(vehicle.licensePlate.toUpperCase()) ?? null,
        }))
        .sort((a, b) => {
          const score = (row: TeslaRow) => {
            if (!row.latest) return 2;
            const { cableStatus: c, adapterStatus: ad } = row.latest;
            if (c === 'missing' && ad === 'missing') return 0;
            if (c === 'missing' || ad === 'missing') return 1;
            return 3;
          };
          return score(a) - score(b);
        });

      setRows(sorted);
      setLoading(false);
    }

    load();
  }, [activeBranch]);

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm">⚡</span>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          EV Asset Status · {rows.length} Tesla{rows.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(({ vehicle, latest }) => {
          const status = latest ? statusLabel(latest) : null;
          return (
            <div key={vehicle.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums shrink-0">
                  {vehicle.licensePlate}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {vehicle.unitNumber}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {status ? (
                  <>
                    <span className={`text-xs font-semibold ${status.color}`}>
                      {status.text}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {fmtDate(latest!.departTime)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">No trips logged</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
