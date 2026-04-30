import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease } from '../types';
import { hapticLight } from '../lib/haptics';
import type { UserRole, Hold, Vehicle, VehicleStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { USERS } from '../data/mock';
import { useBarcodeInterceptor } from '../hooks/useBarcodeInterceptor';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { parseFleetBarcode } from '../lib/barcode';

interface Props {
  onSelectVehicle: (vehicleId: string) => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function Dashboard({ onSelectVehicle, onRegisterAndFlag }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, staleHolds, loading, getVehicleByUnit, releaseStreak, facilityIssues } = useGarage();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeStatusFilter, setActiveStatusFilter] = useState<VehicleStatus | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
      const matchesStatus = activeStatusFilter === null || v.status === activeStatusFilter;
      const matchesSearch = search === '' ||
        v.unitNumber.toUpperCase().includes(search) ||
        v.licensePlate.toUpperCase().includes(search) ||
        v.make.toUpperCase().includes(search) ||
        v.model.toUpperCase().includes(search);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => vehicleLatestActivity(b.id) - vehicleLatestActivity(a.id));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedVehicles = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getLatestHold = (vehicleId: string) =>
    holds.filter(h => h.vehicleId === vehicleId)
         .sort((a, b) => holdLatestActivity(b) - holdLatestActivity(a))[0];

  const getFlaggedBy = (userId: string) =>
    USERS.find(u => u.id === userId)?.name ?? 'Unknown';

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

        {/* Stale Holds Alert — VSA, Lead VSA, and management */}
        <StaleHoldsAlert role={user!.role} staleHolds={staleHolds} vehicles={vehicles} onSelectVehicle={onSelectVehicle} />

        {/* High-severity issue banner */}
        {(() => {
          const count = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
          if (count === 0) return null;
          return (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              <span className="shrink-0">🔴</span>
              <p>
                <strong>{count}</strong> high-severity facility issue{count > 1 ? 's require' : ' requires'} attention.
              </p>
            </div>
          );
        })()}

        {/* Summary Cards — role-aware, tap to filter (Management) */}
        <SummaryCards
          role={user!.role}
          held={held}
          onException={onException}
          preExisting={preExisting}
          returned={returned}
          cleared={cleared}
          activeFilter={activeStatusFilter}
          onFilterChange={handleFilterChange}
        />

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
            const latestHold = getLatestHold(vehicle.id);
            const streak = releaseStreak(vehicle.id);
            return (
              <button
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle.id)}
                className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-left hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">{vehicle.unitNumber}</span>
                      <span className="text-gray-400 dark:text-gray-600 text-xs transition-colors">·</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold transition-colors">{vehicle.licensePlate}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
                    {latestHold && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold mt-1.5 truncate transition-colors">
                        {latestHold.damageDescription.slice(0, 60)}{latestHold.damageDescription.length > 60 ? '…' : ''}
                      </p>
                    )}
                    {latestHold && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                        Flagged by {getFlaggedBy(latestHold.flaggedById)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={vehicle.status} />
                    {streak >= 2 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        streak >= 3
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {streak}× unrepaired
                      </span>
                    )}
                  </div>
                </div>
              </button>
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

        {/* Barcode toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              background: toast.type === 'success' ? 'rgba(22, 101, 52, 0.85)' : 'rgba(153, 27, 27, 0.85)',
              color: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
  );
}

// ── Role-aware summary cards ─────────────────────────────────────────────────

const ACTIVE_CARD_STYLES: Record<VehicleStatus, string> = {
  HELD:             'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/30 border-transparent',
  OUT_ON_EXCEPTION: 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/30 border-transparent',
  PRE_EXISTING:     'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30 border-transparent',
  RETURNED:         'ring-2 ring-gray-400 bg-gray-100 dark:bg-gray-800/50 border-transparent',
  CLEAR:            'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30 border-transparent',
};

const STATUS_LABELS: Record<VehicleStatus, string> = {
  HELD:             'currently held',
  OUT_ON_EXCEPTION: 'on exception',
  PRE_EXISTING:     'pre-existing',
  RETURNED:         'returned',
  CLEAR:            'repaired',
};

interface CardProps {
  value: number;
  label: string;
  color: string;
  status?: VehicleStatus;
  activeFilter?: VehicleStatus | null;
  onFilterChange?: (status: VehicleStatus) => void;
}

function Card({ value, label, color, status, activeFilter, onFilterChange }: CardProps) {
  const isInteractive = !!onFilterChange && !!status;
  const isActive = isInteractive && activeFilter === status;

  if (!isInteractive) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    );
  }

  const baseClasses = 'rounded-xl border p-4 text-center transition-all cursor-pointer';
  const stateClasses = isActive
    ? ACTIVE_CARD_STYLES[status!]
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm';

  return (
    <button
      type="button"
      onClick={() => { hapticLight(); onFilterChange!(status!); }}
      aria-pressed={isActive}
      className={`${baseClasses} ${stateClasses}`}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </button>
  );
}

function SummaryCards({ role, held, onException, preExisting, returned, cleared, activeFilter, onFilterChange }: {
  role: UserRole;
  held: number;
  onException: number;
  preExisting: number;
  returned: number;
  cleared: number;
  activeFilter: VehicleStatus | null;
  onFilterChange: (status: VehicleStatus) => void;
}) {
  // VSA & Lead VSA — no cards, just search and flag
  if (role === 'VSA' || role === 'Lead VSA') return null;

  // CSR & HIR — returned count only (display, no filter — single card has no drill-down value)
  if (role === 'CSR' || role === 'HIR') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xs">
        <Card value={returned} label="Returned" color="text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  // Management — full dashboard, tap any card to filter the list below
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Card value={held}        label="Currently Held" color="text-red-600 dark:text-red-500"       status="HELD"             activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={onException} label="On Exception"   color="text-amber-500"                       status="OUT_ON_EXCEPTION" activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={preExisting} label="Pre-existing"   color="text-blue-600 dark:text-blue-500"     status="PRE_EXISTING"     activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={returned}    label="Returned"       color="text-gray-500 dark:text-gray-400"     status="RETURNED"         activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={cleared}     label="Repaired"       color="text-green-600 dark:text-green-500"   status="CLEAR"            activeFilter={activeFilter} onFilterChange={onFilterChange} />
    </div>
  );
}

// ── Stale holds alert ───────────────────────────────────────────────────────

function StaleHoldsAlert({ role, staleHolds, vehicles, onSelectVehicle }: {
  role: UserRole;
  staleHolds: Hold[];
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
}) {
  // Not relevant for CSR/HIR — they handle returns, not hold follow-up
  if (role === 'CSR' || role === 'HIR') return null;
  if (staleHolds.length === 0) return null;

  const staleItems = staleHolds.map(h => {
    const v = vehicles.find(v => v.id === h.vehicleId);
    return { vehicleId: h.vehicleId, unitNumber: v?.unitNumber ?? 'Unknown' };
  });

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
      <p className="font-semibold mb-1.5">
        ⚠️ {staleHolds.length} hold{staleHolds.length > 1 ? 's have' : ' has'} been active for more than 48 hours
      </p>
      <div className="flex flex-wrap gap-1.5">
        {staleItems.map(({ vehicleId, unitNumber }) => (
          <button
            key={vehicleId}
            type="button"
            onClick={() => onSelectVehicle(vehicleId)}
            className="bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-md text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-700/60 cursor-pointer transition-colors"
          >
            {unitNumber}
          </button>
        ))}
      </div>
    </div>
  );
}
