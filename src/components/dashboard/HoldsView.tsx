import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { canRelease, canManageVehicles } from '../../types';
import { hapticLight } from '../../lib/haptics';
import type { Hold, Vehicle, VehicleStatus } from '../../types';
import { useUserResolver } from '../../hooks/useUserResolver';
import { useBarcodeInterceptor } from '../../hooks/useBarcodeInterceptor';
import { CameraBarcodeScanner } from '../shared/CameraBarcodeScanner';
import { parseFleetBarcode } from '../../lib/barcode';
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
  onSelectVehicle: (vehicleId: string) => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function HoldsView({ onSelectVehicle, onRegisterAndFlag }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, staleHolds, loading, loadError, reload, getVehicleByUnit, releaseStreak, archivedVehicles, restoreVehicle } = useVehicleHoldContext();
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
  const [archivedOpen, setArchivedOpen] = useState(false);
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

  const ITEMS_PER_PAGE = 15;

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
      showToast(`✨ ${vehicle.unitNumber} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`, 'success');
      onSelectVehicle(vehicle.id);
    } else {
      showToast(`Unit ${unit} not in system`, 'error');
    }
  }, [getVehicleByUnit, onSelectVehicle, showToast]);

  const handleBarcodeUnrecognized = useCallback(() => {
    showToast('Unrecognized barcode — enter unit number manually', 'error');
  }, [showToast]);

  const handleCameraDecode = useCallback((raw: string) => {
    const result = parseFleetBarcode(raw);
    if (result.ok) {
      handleBarcodeUnit(result.unit);
    } else {
      handleBarcodeUnrecognized();
    }
  }, [handleBarcodeUnit, handleBarcodeUnrecognized]);

  useBarcodeInterceptor({
    inputRef: searchRef,
    onUnit: handleBarcodeUnit,
    onUnrecognized: handleBarcodeUnrecognized,
  });

  const held        = vehicles.filter(v => v.status === 'HELD').length;
  const returned    = vehicles.filter(v => v.status === 'RETURNED').length;
  const preExisting = vehicles.filter(v => v.status === 'PRE_EXISTING').length;
  const cleared     = vehicles.filter(v => v.status === 'CLEAR').length;

  // Latest meaningful timestamp for a hold: repair → release → creation
  const holdLatestActivity = (h: Hold) => {
    if (h.repair?.repairedAt)  return new Date(h.repair.repairedAt).getTime();
    if (h.release?.approvedAt) return new Date(h.release.approvedAt).getTime();
    return new Date(h.flaggedAt).getTime();
  };

  // Latest activity across all holds for a vehicle (0 = no holds)
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

  const getDisplayHold = (vehicleId: string, status: VehicleStatus) => {
    const vh = holds.filter(h => h.vehicleId === vehicleId);
    if (vh.length === 0) return undefined;
    // For status-specific states, prefer the hold that caused that status
    if (status === 'HELD')             return vh.find(h => h.status === 'ACTIVE') ?? vh[0];
    if (status === 'PRE_EXISTING')     return vh.find(h => h.release?.releaseType === 'PRE_EXISTING') ?? vh[0];
    if (status === 'OUT_ON_EXCEPTION') return vh.find(h => h.release?.releaseType === 'EXCEPTION') ?? vh[0];
    return vh.sort((a, b) => holdLatestActivity(b) - holdLatestActivity(a))[0];
  };

  const { getName } = useUserResolver();

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenVehicle = (vehicle: Vehicle) => {
    if (search.trim()) setPendingVehicle(vehicle);
    else onSelectVehicle(vehicle.id);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load fleet data. Check your connection.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-black text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Holds</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">Flagged vehicles · damage | mechanical | detail</p>
        </div>

        <HoldsTabStrip activeTab={activeTab} onTab={setActiveTab} />

        {activeTab === 'ev-assets' ? <EVAssetsTab /> : (
          <>
        {/* Stale Holds Alert — management only */}
        <StaleHoldsAlert role={user!.role} staleHolds={staleHolds} vehicles={vehicles} onSelectVehicle={onSelectVehicle} />

        {/* Summary Cards — role-aware, tap to filter (Management) */}
        <DashboardSummaryCards
          role={user!.role}
          held={held}
          preExisting={preExisting}
          returned={returned}
          cleared={cleared}
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
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-yellow-500 focus:border-transparent transition-all uppercase shadow-sm"
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
          <CameraBarcodeScanner onDecode={handleCameraDecode} />
        </div>

        {/* Exception returns — collapsible; auto-expands when search matches an exception vehicle */}
        <ExceptionReturnSection search={search} />

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
              isManagement={canRelease(user!.role)}
              onTogglePin={togglePin}
              onOpen={handleOpenVehicle}
              getName={getName}
            />
          ))}
          {filtered.length === 0 && search.trim().length >= 2 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-400 text-sm">"{search}" not in the system.</p>
              <button
                onClick={() => onRegisterAndFlag(search)}
                className="text-sm font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer"
              >
                + Add to ledger &amp; flag →
              </button>
            </div>
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

        {/* Archived Vehicles */}
        {canManageVehicles(user!.role) && archivedVehicles.length > 0 && (
          <ArchivedVehiclesSection
            archivedVehicles={archivedVehicles}
            open={archivedOpen}
            onToggle={() => setArchivedOpen(o => !o)}
            onRestore={restoreVehicle}
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
            onConfirm={() => { setPendingVehicle(null); onSelectVehicle(pendingVehicle.id); }}
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
