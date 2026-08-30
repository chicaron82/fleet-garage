// Effie's resolved writes for ONE car. Sibling of useVehicleChanges, and stamped the same way.
//
// The filtering is a PURE function (`effieWritesForVehicle`) rather than a PostgREST jsonb filter,
// because a proposal names its car in three different places depending on kind — `vehicleId`,
// `vehicle.vehicleId`, or `newVehicle.plate` — and a register proposal has no id at all. Expressing
// that as an `.or()` string would be a fragile filter that fails SILENTLY to an empty list, which
// on a provenance trail looks identical to "Effie never touched this car".
//
// ⚠️ The cost is a bounded fetch: the most recent RESOLVED proposals, then matched client-side.
// The table holds 12 rows today and grows by a handful a week, so the cap is generous. Revisit if
// it ever approaches MAX_ROWS — at which point the oldest writes for a car would silently vanish
// from its record, and a jsonb filter becomes worth the fragility.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { effieWritesForVehicle, type EffieWriteLike } from '../lib/effieVehicleTrail';
import type { Proposal } from '../../api/_lib/holdProposal';

const MAX_ROWS = 500;

export function useVehicleEffieWrites(
  vehicleId: string | null | undefined,
  licensePlate: string | null | undefined,
): EffieWriteLike[] {
  // ⚠️ Rows are STAMPED with the vehicle they were fetched for and only read back on a match — the
  // guard useVehicleChanges and useVehicleSightings both carry, for the reason spelled out there:
  // without it, the gap between navigating to a new car and its fetch landing renders the PREVIOUS
  // car's trail under the new car's plate. On an audit surface that is not a flicker, it is a lie.
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<{ key: string; rows: EffieWriteLike[] } | null>(null);
  const key = `${vehicleId ?? ''}|${licensePlate ?? ''}`;

  useEffect(() => {
    if (!user || (!vehicleId && !licensePlate)) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('effie_pending_writes')
        .select('id, kind, proposal, source, status, created_at, resolved_at, proposed_by, resolved_by')
        .in('status', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS);
      if (cancelled) return;
      const all: EffieWriteLike[] = (data ?? []).map(r => ({
        id: r.id as string,
        kind: r.kind as string,
        proposal: r.proposal as unknown as Proposal,
        source: r.source as string,
        status: r.status as 'approved' | 'rejected',
        createdAt: r.created_at as string,
        resolvedAt: r.resolved_at as string | null,
        proposedBy: r.proposed_by as string,
        resolvedBy: r.resolved_by as string | null,
      }));
      setLoaded({ key, rows: effieWritesForVehicle(all, vehicleId, licensePlate) });
    }
    void load();
    return () => { cancelled = true; };
  }, [user, vehicleId, licensePlate, key]);

  return loaded?.key === key ? loaded.rows : [];
}
