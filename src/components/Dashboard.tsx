import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease, canManageVehicles } from '../types';
import { hapticLight } from '../lib/haptics';
import type { Hold, Vehicle, VehicleStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { holdContextEmojis } from '../lib/holdBadge';
import { useUserResolver } from '../hooks/useUserResolver';
import { useBarcodeInterceptor } from '../hooks/useBarcodeInterceptor';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { parseFleetBarcode } from '../lib/barcode';
import { DashboardSummaryCards } from './DashboardSummaryCards';
import { PendingApprovalsSection } from './PendingApprovalsSection';
import { StaleHoldsAlert } from './StaleHoldsAlert';
import { BarcodeToast } from './BarcodeToast';
import { PendingVehicleSheet } from './PendingVehicleSheet';
interface Props {
  onSelectVehicle: (vehicleId: string) => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function Dashboard({ onSelectVehicle, onRegisterAndFlag }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, staleHolds, loading, getVehicleByUnit, releaseStreak, archivedVehicles, restoreVehicle } = useGarage();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('dashboard_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [activeStatusFilter, setActiveStatusFilter] = useState<VehicleStatus | null>(null);
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
  const onException = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;
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
        v.model.toUpperCase().includes(search);
      if (!matchesSearch) return false;
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

  const paginationControls = totalPages > 1 ? (
    <div className="flex items-center justify-between py-2 transition-colors">
      <button
        disabled={currentPage === 1}
        onClick={() => {
          setCurrentPage(p => p - 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Page <span className="font-medium text-gray-900 dark:text-gray-100">{currentPage}</span> of {totalPages}
      </span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => {
          setCurrentPage(p => p + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  ) : null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Stale Holds Alert — management only */}
        <StaleHoldsAlert role={user!.role} staleHolds={staleHolds} vehicles={vehicles} onSelectVehicle={onSelectVehicle} />

        {/* Summary Cards — role-aware, tap to filter (Management) */}
        <DashboardSummaryCards
          role={user!.role}
          held={held}
          onException={onException}
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

        {/* Management banner */}
        {canRelease(user!.role) && onException > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
            ⚠️ <strong>{onException}</strong> vehicle{onException > 1 ? 's are' : ' is'} currently out on exception and may need a return follow-up.
          </div>
        )}

        {/* Vehicle List */}
        <div className="space-y-2">
          {loading && (
            <p className="text-center text-gray-400 text-sm py-8 transition-colors">Loading…</p>
          )}
          
          {paginationControls && (
            <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-800 transition-colors">
              {paginationControls}
            </div>
          )}

          {paginatedVehicles.map(vehicle => {
            const latestHold = getDisplayHold(vehicle.id, vehicle.status);
            const streak = releaseStreak(vehicle.id);
            const isPinned = pinnedVehicleIds.has(vehicle.id);
            const isManagement = canRelease(user!.role);
            return (
              <div key={vehicle.id} className="flex items-stretch gap-1.5">
                {isManagement && (
                  <button
                    type="button"
                    onClick={() => togglePin(vehicle.id)}
                    aria-label={isPinned ? 'Unpin' : 'Pin to top'}
                    className={`shrink-0 w-7 flex items-center justify-center rounded-lg transition-colors ${
                      isPinned
                        ? 'text-red-500'
                        : 'text-gray-200 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500'
                    }`}
                  >
                    📌
                  </button>
                )}
                <button
                  onClick={() => {
                    hapticLight();
                    if (search.trim()) setPendingVehicle(vehicle);
                    else onSelectVehicle(vehicle.id);
                  }}
                  className={`flex-1 bg-white dark:bg-gray-900 rounded-xl border p-4 text-left hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-sm transition-all cursor-pointer group ${
                    isPinned
                      ? 'border-red-300 dark:border-red-700/60'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-base group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">{vehicle.unitNumber}</span>
                        <span className="text-gray-400 dark:text-gray-600 text-xs transition-colors">·</span>
                        <span className="text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors">{vehicle.licensePlate}</span>
                        {(() => {
                          const emojis = holdContextEmojis(vehicle.status, latestHold?.holdTypes ?? [], latestHold?.detailReason, latestHold?.mechanicalSubType);
                          return emojis.length > 0
                            ? <span className="text-sm leading-none tracking-tight">{emojis.join(' ')}</span>
                            : null;
                        })()}
                      </div>
                      <p className="text-base font-medium text-gray-800 dark:text-gray-200 transition-colors">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
                      {latestHold && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1.5 truncate transition-colors">
                          {latestHold.damageDescription.slice(0, 40)}{latestHold.damageDescription.length > 40 ? '…' : ''}
                        </p>
                      )}
                      {latestHold && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                          Flagged by {getName(latestHold.flaggedById, latestHold.flaggedByName)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={vehicle.status} holdTypes={latestHold?.holdTypes} mechanicalSubType={latestHold?.mechanicalSubType} />
                      {streak >= 2 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          streak >= 3
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                          {streak}× unrepaired
                        </span>
                      )}
                      {vehicle.coverPhotoUrl && (
                        <img
                          src={vehicle.coverPhotoUrl}
                          alt="Vehicle"
                          className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 mt-0.5"
                        />
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
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
          
          {paginationControls && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 transition-colors">
              {paginationControls}
            </div>
          )}
        </div>

        {/* Archived Vehicles */}
        {canManageVehicles(user!.role) && archivedVehicles.length > 0 && (
          <section className="mt-6 px-4 pb-2">
            <button
              type="button"
              onClick={() => setArchivedOpen(o => !o)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest cursor-pointer"
            >
              <span>{archivedOpen ? '▾' : '▸'}</span>
              <span>Archived · {archivedVehicles.length}</span>
            </button>
            {archivedOpen && (
              <div className="mt-3 space-y-2">
                {archivedVehicles.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {v.unitNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {v.year} {v.make} {v.model} · {v.licensePlate}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Archived {v.archivedAt
                          ? new Date(v.archivedAt).toLocaleDateString('en-CA', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => { hapticLight(); await restoreVehicle(v.id); }}
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer shrink-0 ml-3"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
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
