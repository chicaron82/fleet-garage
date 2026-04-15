import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease } from '../types';
import type { UserRole, Hold, Vehicle } from '../types';
import { StatusBadge } from './StatusBadge';
import { USERS } from '../data/mock';

interface Props {
  onSelectVehicle: (vehicleId: string) => void;
  onNewHold: () => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function Dashboard({ onSelectVehicle, onNewHold, onRegisterAndFlag }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, staleHolds, loading } = useGarage();
  const [search, setSearch] = useState('');

  const held        = vehicles.filter(v => v.status === 'HELD').length;
  const onException = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;
  const returned    = vehicles.filter(v => v.status === 'RETURNED').length;
  const preExisting = vehicles.filter(v => v.status === 'PRE_EXISTING').length;
  const cleared     = vehicles.filter(v => v.status === 'CLEAR').length;

  const filtered = vehicles.filter(v =>
    search === '' ||
    v.unitNumber.toUpperCase().includes(search) ||
    v.licensePlate.toUpperCase().includes(search) ||
    v.make.toUpperCase().includes(search) ||
    v.model.toUpperCase().includes(search)
  );

  const getLatestHold = (vehicleId: string) =>
    holds.filter(h => h.vehicleId === vehicleId)
         .sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime())[0];

  const getFlaggedBy = (userId: string) =>
    USERS.find(u => u.id === userId)?.name ?? 'Unknown';

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Stale Holds Alert — VSA, Lead VSA, and management */}
        <StaleHoldsAlert role={user!.role} staleHolds={staleHolds} vehicles={vehicles} />

        {/* Summary Cards — role-aware */}
        <SummaryCards
          role={user!.role}
          held={held}
          onException={onException}
          preExisting={preExisting}
          returned={returned}
          cleared={cleared}
        />

        {/* Search + Add Hold */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search unit #, plate, make…"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-yellow-500 focus:border-transparent transition-all uppercase shadow-sm"
          />
          <button
            onClick={onNewHold}
            className="px-4 py-2.5 bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400 text-black font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            + Flag Vehicle
          </button>
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
          {filtered.map(vehicle => {
            const latestHold = getLatestHold(vehicle.id);
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
                      <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">{vehicle.licensePlate}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
                    {latestHold && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 truncate transition-colors">
                        {latestHold.damageDescription.slice(0, 60)}{latestHold.damageDescription.length > 60 ? '…' : ''}
                      </p>
                    )}
                    {latestHold && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                        Flagged by {getFlaggedBy(latestHold.flaggedById)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={vehicle.status} />
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
        </div>
      </div>
  );
}

// ── Role-aware summary cards ─────────────────────────────────────────────────

interface CardProps { value: number; label: string; color: string }

function Card({ value, label, color }: CardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SummaryCards({ role, held, onException, preExisting, returned, cleared }: {
  role: UserRole;
  held: number;
  onException: number;
  preExisting: number;
  returned: number;
  cleared: number;
}) {
  // VSA & Lead VSA — no cards, just search and flag
  if (role === 'VSA' || role === 'Lead VSA') return null;

  // CSR & HIR — returned count only (they handle returns at the counter)
  if (role === 'CSR' || role === 'HIR') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xs">
        <Card value={returned} label="Returned" color="text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  // Management — full dashboard
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Card value={held} label="Currently Held" color="text-red-600 dark:text-red-500" />
      <Card value={onException} label="On Exception" color="text-amber-500" />
      <Card value={preExisting} label="Pre-existing" color="text-blue-600 dark:text-blue-500" />
      <Card value={returned} label="Returned" color="text-gray-500 dark:text-gray-400" />
      <Card value={cleared} label="Repaired" color="text-green-600 dark:text-green-500" />
    </div>
  );
}

// ── Stale holds alert ───────────────────────────────────────────────────────

function StaleHoldsAlert({ role, staleHolds, vehicles }: {
  role: UserRole;
  staleHolds: Hold[];
  vehicles: Vehicle[];
}) {
  // Not relevant for CSR/HIR — they handle returns, not hold follow-up
  if (role === 'CSR' || role === 'HIR') return null;
  if (staleHolds.length === 0) return null;

  const unitNumbers = staleHolds.map(h => {
    const v = vehicles.find(v => v.id === h.vehicleId);
    return v?.unitNumber ?? 'Unknown';
  });

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
      <p className="font-semibold mb-1">
        ⚠️ {staleHolds.length} hold{staleHolds.length > 1 ? 's have' : ' has'} been active for more than 48 hours
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        {unitNumbers.join(', ')}
      </p>
    </div>
  );
}
