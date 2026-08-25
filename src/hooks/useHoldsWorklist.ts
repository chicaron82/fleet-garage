import { displayHoldFor, holdLatestActivity } from '../lib/displayHold';
import type { Hold, Vehicle, VehicleStatus } from '../types';

// The Holds worklist — which cars the board shows, in what order, on which page.
//
// Extracted out of HoldsView 2026-08-25, which had crept to two lines under the 330 cap. The
// markup was never the weight: the file's real bulk was this derivation pipeline — status counts,
// a search across five fields, the exception carve-out, the pinned-first sort, pagination, and the
// two "did the search find anything" questions. All of it is a pure function of (fleet, holds,
// filter state); none of it needs to be inside a component.
//
// Deriving rather than storing is also what keeps it honest: every value here recomputes each
// render, so none of it can go stale against the fleet the way captured state would.

const ITEMS_PER_PAGE = 15;

export interface HoldsWorklist {
  /** Status tallies for the summary cards — the WHOLE fleet, never the filtered view. */
  counts: { held: number; returned: number; preExisting: number; cleared: number };
  /** The filtered, sorted worklist — pinned first, then most-recently-touched. */
  filtered: Vehicle[];
  paginatedVehicles: Vehicle[];
  totalPages: number;
  /** Typed ≥2 chars and nothing active matched — flips the search-row button to "add to FG". */
  noMatch: boolean;
  /** How many ARCHIVED cars the same search matches, so a miss can point at the archive. */
  archivedMatchCount: number;
  getDisplayHold: (vehicleId: string, status: VehicleStatus) => Hold | undefined;
}

export function useHoldsWorklist(input: {
  vehicles: Vehicle[];
  holds: Hold[];
  archivedVehicles: Vehicle[];
  search: string;
  activeStatusFilter: VehicleStatus | null;
  pinnedVehicleIds: Set<string>;
  currentPage: number;
}): HoldsWorklist {
  const { vehicles, holds, archivedVehicles, search, activeStatusFilter, pinnedVehicleIds, currentPage } = input;

  const counts = {
    held:        vehicles.filter(v => v.status === 'HELD').length,
    returned:    vehicles.filter(v => v.status === 'RETURNED').length,
    preExisting: vehicles.filter(v => v.status === 'PRE_EXISTING').length,
    cleared:     vehicles.filter(v => v.status === 'CLEAR').length,
  };

  /** Latest activity across all of a vehicle's holds (0 = no holds, so it sorts to the bottom). */
  const vehicleLatestActivity = (vehicleId: string) => {
    const vh = holds.filter(h => h.vehicleId === vehicleId);
    if (vh.length === 0) return 0;
    return Math.max(...vh.map(holdLatestActivity));
  };

  const filtered = vehicles
    .filter(v => {
      const matchesSearch = search === '' ||
        (v.unitNumber?.toUpperCase() ?? '').includes(search) ||
        v.licensePlate.toUpperCase().includes(search) ||
        v.make.toUpperCase().includes(search) ||
        v.model.toUpperCase().includes(search) ||
        holds.some(h => h.vehicleId === v.id && h.status === 'ACTIVE' && h.damageDescription.toUpperCase().includes(search));
      if (!matchesSearch) return false;
      // Exception vehicles live exclusively in ExceptionReturnSection — never in the main list
      if (v.status === 'OUT_ON_EXCEPTION') return false;
      if (activeStatusFilter !== null) return v.status === activeStatusFilter;
      // CLEAR vehicles drop off the default list — searchable, accessible via "Repaired" card
      if (v.status === 'CLEAR' && search === '') return false;
      return true;
    })
    .sort((a, b) => {
      const aPinned = pinnedVehicleIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedVehicleIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return vehicleLatestActivity(b.id) - vehicleLatestActivity(a.id);
    });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedVehicles = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const noMatch = filtered.length === 0 && search.trim().length >= 2;

  // Counted only once the search is real (≥2 chars) — the same threshold `noMatch` uses, so the
  // "it's archived ↓" note and the button flip can never disagree about whether a search happened.
  const archivedMatchCount = search.trim().length >= 2
    ? archivedVehicles.filter(v => {
        const q = search.toUpperCase();
        return (v.unitNumber?.toUpperCase() ?? '').includes(q) ||
          v.licensePlate.toUpperCase().includes(q) ||
          v.make.toUpperCase().includes(q) ||
          v.model.toUpperCase().includes(q);
      }).length
    : 0;

  const getDisplayHold = (vehicleId: string, status: VehicleStatus) =>
    displayHoldFor(holds, vehicleId, status, holdLatestActivity);

  return { counts, filtered, paginatedVehicles, totalPages, noMatch, archivedMatchCount, getDisplayHold };
}
