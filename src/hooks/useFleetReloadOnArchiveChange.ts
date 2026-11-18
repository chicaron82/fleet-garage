import { useEffect, useRef } from 'react';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { loadFleet, type FleetVehicle } from '../lib/fleet-master';

/**
 * ⚠️ Fleet keeps its OWN copy of the car list (`loadFleet`), and restore/archive only update the context's. So a car he
 * had just restored was reported as missing. Aaron's screenshot, 2026-11-18 14:33: *"No active vehicle found for LUR528"*,
 * about 7 minutes after `vehicle_changes` shows he restored it (docs/ticket-recent-cars-everywhere-and-restore-from-find.md).
 * A confident wrong answer, the thing FG exists to stop.
 *
 * So Fleet re-reads, quietly, whenever the set of archived cars changes: a restore from the Archived section, from
 * Register, or from Find a car on top of this screen. No "Loading fleet…" flash; the list he is looking at stays put
 * until the fresh one lands. A failed re-read keeps the list he has (the next visit loads it again).
 */
export function useFleetReloadOnArchiveChange(branchId: string | undefined, setVehicles: (v: FleetVehicle[]) => void) {
  const { archivedVehicles } = useVehicleHoldContext();
  const sig = archivedVehicles.map(v => v.id).sort().join(',');
  const seen = useRef(sig);
  useEffect(() => {
    if (!branchId || sig === seen.current) return;
    seen.current = sig;
    let live = true;
    loadFleet(branchId).then(data => { if (live) setVehicles(data); }, () => {});
    return () => { live = false; };
  }, [sig, branchId, setVehicles]);
}
