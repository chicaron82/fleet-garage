import { useState, useRef, useCallback, useEffect } from 'react';
import { vehicleNameText } from '../../lib/vehicleName';
import { ZoneBackfillCard } from '../holds/ZoneBackfillCard';
import { useHoldsWorklist } from '../../hooks/useHoldsWorklist';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useBackfillOnScan } from '../../hooks/useBackfillOnScan';
import { canRelease, canManageVehicles } from '../../types';
import { hapticLight } from '../../lib/haptics';
import type { Vehicle, VehicleStatus } from '../../types';
import { useUserResolver } from '../../hooks/useUserResolver';
import { useBarcodeInterceptor } from '../../hooks/useBarcodeInterceptor';
import { KeytagSearchScan } from '../holds/KeytagSearchScan';
import { ModuleHeader } from '../shared/ModuleHeader';
import { Sparkles } from '../shared/Sparkles';
import { PrimaryAction } from '../shared/PrimaryAction';
import { DashboardSummaryCards } from './DashboardSummaryCards';
import { PendingApprovalsSection } from '../my-shift/PendingApprovalsSection';
import { StaleHoldsAlert } from './StaleHoldsAlert';
import { BarcodeToast } from '../shared/BarcodeToast';
import { PendingVehicleSheet } from '../shared/PendingVehicleSheet';
import { HoldsVehicleRow } from './HoldsVehicleRow';
import { ArchivedVehiclesSection } from './ArchivedVehiclesSection';
import { HoldsPagination } from './HoldsPagination';
import { HoldsTabStrip, type HoldsTab } from './HoldsTabStrip';
import { EVAssetsTab } from '../holds/EVAssetsTab';
import { ExceptionReturnSection } from '../holds/ExceptionReturnSection';
interface Props {
  /** `cohort` is the list AS DISPLAYED — his filter, his sort — so the record can offer prev/next
   *  through the same worklist instead of sending him back here to find the next car. */
  onSelectVehicle: (vehicleId: string, cohort?: string[]) => void;
  /** Opens the damage-zone backfill run. The card that uses it hides itself once the queue empties. */
  onOpenZoneBackfill: () => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function HoldsView({ onSelectVehicle, onRegisterAndFlag, onOpenZoneBackfill }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, staleHolds, loading, loadError, reload, getVehicleByUnit, releaseStreak, archivedVehicles, restoreVehicle, updateVehicleFields, attachKeytagPhotoIfMissing } = useVehicleHoldContext();
  // A scanned tag fills an on-record car's blanks here, at the scan — see docs/ticket-backfill-at-scan.md.
  // Passing attach makes the holds search-scan also save the tag to a known car that lacks one.
  const { backfillToast, backfillFromRead } = useBackfillOnScan({ vehicles, updateVehicleFields, attachKeytagPhotoIfMissing });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<HoldsTab>('holds');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('dashboard_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [activeStatusFilter, setActiveStatusFilter] = useState<VehicleStatus | null>(() => {
    const saved = sessionStorage.getItem('dashboard_status_filter');
    return saved ? saved as VehicleStatus : null;
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pendingVehicle, setPendingVehicle] = useState<Vehicle | null>(null);
  const [pinnedVehicleIds, setPinnedVehicleIds] = useState<Set<string>>(new Set());

  const togglePin = useCallback((vehicleId: string) => {
    hapticLight();
    setPinnedVehicleIds(prev => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId); else next.add(vehicleId);
      return next;
    });
  }, []);

  useEffect(() => {
    sessionStorage.setItem('dashboard_page', String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (activeStatusFilter) sessionStorage.setItem('dashboard_status_filter', activeStatusFilter);
    else sessionStorage.removeItem('dashboard_status_filter');
  }, [activeStatusFilter]);

  const handleFilterChange = useCallback((status: VehicleStatus | null) => {
    setActiveStatusFilter(prev => (prev === status ? null : status));
    setCurrentPage(1);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleBarcodeUnit = useCallback((unit: string) => {
    setSearch(unit.toUpperCase());
    setCurrentPage(1);
    const vehicle = getVehicleByUnit(unit);
    if (vehicle) {
      showToast(`✨ ${vehicle.unitNumber} — ${vehicleNameText(vehicle)}`, 'success');
      onSelectVehicle(vehicle.id);
    } else {
      showToast(`Unit ${unit} not in system`, 'error');
    }
  }, [getVehicleByUnit, onSelectVehicle, showToast]);

  const handleBarcodeUnrecognized = useCallback(() => {
    showToast('Unrecognized barcode — enter unit number manually', 'error');
  }, [showToast]);

  // Keytag scan → plate (MB-corrected upstream): fill the search + surface the vehicle,
  // mirroring the old barcode-by-unit path but keyed on plate (what the tag reads).
  const handleKeytagPlate = useCallback((plate: string) => {
    setSearch(plate.toUpperCase());
    setCurrentPage(1);
    const vehicle = vehicles.find(v => v.licensePlate.trim().toUpperCase() === plate.toUpperCase());
    if (vehicle) {
      // A thin record (a geotab placeholder: no unit#, year 0, blank make/model) must degrade to
      // the plate rather than render "✨ null — 0". The scan's backfill fills it a beat later.
      const identity = [vehicle.year || null, vehicle.make, vehicle.model].filter(Boolean).join(' ');
      showToast(`✨ ${vehicle.unitNumber ?? plate.toUpperCase()}${identity ? ` — ${identity}` : ''}`, 'success');
      onSelectVehicle(vehicle.id);
    } else {
      showToast(`${plate} not in system`, 'error');
    }
  }, [vehicles, onSelectVehicle, showToast]);

  useBarcodeInterceptor({
    inputRef: searchRef,
    onUnit: handleBarcodeUnit,
    onUnrecognized: handleBarcodeUnrecognized,
  });

  // Which cars the board shows, in what order, on which page — all derived, never captured.
  const { counts, filtered, paginatedVehicles, totalPages, noMatch, archivedMatchCount, getDisplayHold } =
    useHoldsWorklist({ vehicles, holds, archivedVehicles, search, activeStatusFilter, pinnedVehicleIds, currentPage });

  const { getName } = useUserResolver();

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenVehicle = (vehicle: Vehicle) => {
    if (search.trim()) setPendingVehicle(vehicle);
    // The FILTERED, SORTED list — not the page. He works a status down; the arrows should follow
    // that same run of cars past the page boundary rather than stopping at 20.
    else onSelectVehicle(vehicle.id, filtered.map(v => v.id));
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load fleet data. Check your connection.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <ModuleHeader
          title="Holds"
          subtitle="Flagged vehicles · damage | mechanical | detail"
        />

        <HoldsTabStrip activeTab={activeTab} onTab={setActiveTab} />

        {/* Finite job, temporary door — renders only while holds are still untagged. */}
        <ZoneBackfillCard onOpen={onOpenZoneBackfill} />

        {activeTab === 'ev-assets' ? <EVAssetsTab /> : (
          <>
        {/* Stale Holds Alert — management only */}
        <StaleHoldsAlert role={user!.role} staleHolds={staleHolds} vehicles={vehicles} onSelectVehicle={onSelectVehicle} />

        {/* Summary Cards — role-aware, tap to filter (Management) */}
        <DashboardSummaryCards
          role={user!.role}
          held={counts.held}
          preExisting={counts.preExisting}
          returned={counts.returned}
          cleared={counts.cleared}
          activeFilter={activeStatusFilter}
          onFilterChange={handleFilterChange}
        />

        {/* Pending Approvals Queue — managers only */}
        {canRelease(user!.role) && (
          <PendingApprovalsSection
            holds={holds}
            vehicles={vehicles}
            onSelectVehicle={onSelectVehicle}
          />
        )}

        {/* Search + Add Hold */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search unit #, plate, make…"
              value={search}
              onChange={e => {
                setSearch(e.target.value.toUpperCase());
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition-all uppercase shadow-sm"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none cursor-pointer"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {noMatch
            ? <PrimaryAction label="Add to FG & flag" onClick={() => onRegisterAndFlag(search)} />
            : <KeytagSearchScan onPlate={handleKeytagPlate} onRead={(read, photo) => void backfillFromRead(read, photo)} />}
          {/* Never fill silently — name what the tag just landed on the record. */}
          {backfillToast && (
            <p className="relative text-xs font-semibold text-green-700 dark:text-green-400">
              {backfillToast}<Sparkles size="0.75rem" /></p>
          )}
        </div>

        {/* Exception returns — collapsible; auto-expands when search matches an exception vehicle */}
        <ExceptionReturnSection search={search} onOpenVehicle={onSelectVehicle} />

        {/* Vehicle List */}
        <div className="space-y-2">
          {loading && (
            <p className="text-center text-gray-400 text-sm py-8 transition-colors">Loading…</p>
          )}
          
          {totalPages > 1 && (
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-800 transition-colors">
              <HoldsPagination currentPage={currentPage} totalPages={totalPages} onChange={goToPage} />
            </div>
          )}

          {paginatedVehicles.map(vehicle => (
            <HoldsVehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              latestHold={getDisplayHold(vehicle.id, vehicle.status)}
              streak={releaseStreak(vehicle.id)}
              isPinned={pinnedVehicleIds.has(vehicle.id)}
              onTogglePin={togglePin}
              onOpen={handleOpenVehicle}
              getName={getName}
            />
          ))}
          {noMatch && (
            archivedMatchCount > 0 ? (
              <p className="text-center text-amber-700 dark:text-amber-400 text-sm py-8 font-medium">
                "{search}" is archived — {archivedMatchCount} match{archivedMatchCount === 1 ? '' : 'es'} below ↓
              </p>
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">"{search}" not in the system.</p>
            )
          )}
          {filtered.length === 0 && search.trim().length < 2 && search.trim().length > 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Keep typing to search…</p>
          )}
          {filtered.length === 0 && search.trim() === '' && activeStatusFilter !== null && (
            <div className="text-center py-8 space-y-2">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No vehicles {STATUS_LABELS[activeStatusFilter]}.
              </p>
              <button
                onClick={() => handleFilterChange(activeStatusFilter)}
                className="text-sm font-semibold text-yellow-600 hover:text-yellow-700 transition cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
              <HoldsPagination currentPage={currentPage} totalPages={totalPages} onChange={goToPage} />
            </div>
          )}
        </div>

        {/* Archived Vehicles — search surfaces a match here (auto-expanded) even when the active
            fleet has none, mirroring the Issue Log / ExceptionReturnSection. */}
        {canManageVehicles(user!.role) && (
          <ArchivedVehiclesSection
            archivedVehicles={archivedVehicles}
            onRestore={restoreVehicle}
            search={search}
          />
        )}

        {/* Barcode toast */}
        <BarcodeToast toast={toast} />

        {/* Search confirmation sheet */}
        {pendingVehicle && (
          <PendingVehicleSheet
            vehicle={pendingVehicle}
            hold={getDisplayHold(pendingVehicle.id, pendingVehicle.status)}
            onClose={() => setPendingVehicle(null)}
            onConfirm={() => { setPendingVehicle(null); onSelectVehicle(pendingVehicle.id, filtered.map(v => v.id)); }}
          />
        )}
          </>
        )}
      </div>
  );
}

const STATUS_LABELS: Record<VehicleStatus, string> = {
  HELD:               'currently held',
  OUT_ON_EXCEPTION:   'on exception',
  PRE_EXISTING:       'pre-existing',
  RETURNED:           'returned',
  CLEAR:              'repaired',
  SALE_CAR:           'sale car',
  AUCTION_SHORT_TERM: 'auction — short term',
};
