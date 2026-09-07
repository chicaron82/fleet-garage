import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { ArchivedVehiclesSection } from '../dashboard/ArchivedVehiclesSection';
import { canManageVehicles } from '../../types';

/**
 * ⭐⭐ ARCHIVED CARS, IN FLEET — because Fleet is where you go to look a vehicle up.
 *
 * Aaron, 2026-09-06: *"move the archived vehicles to be shown collapsed there too. since searching
 * for them in fleet shows up empty but is searchable in the holds module where they are currently
 * located."*
 *
 * ⚠️ THE BUG WAS THE DEAD END, NOT THE MISSING LIST. Fleet's search is the one that answers *"does
 * FG know this car"* — and for an archived plate it answered **no**, while the row existed one
 * module away. A search that returns nothing about a car FG holds is worse than no search: it is a
 * confident wrong answer, which is the thing this whole app exists to stop.
 *
 * ⭐ The section already knew how to behave — collapsed by default, auto-expanding on a search
 * match, hiding itself when a search matches nothing archived. It was in the wrong room, not the
 * wrong shape. This is a thin adapter so `FleetMasterView` does not grow a context dependency (and
 * so its register-path test can stub one component instead of mocking a provider).
 */
export function FleetArchivedSection({ search }: { search: string }) {
  const { user } = useAuth();
  const { archivedVehicles, restoreVehicle } = useVehicleHoldContext();
  if (!user || !canManageVehicles(user.role)) return null;
  return (
    <ArchivedVehiclesSection
      archivedVehicles={archivedVehicles}
      onRestore={restoreVehicle}
      search={search}
    />
  );
}
