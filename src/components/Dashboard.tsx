import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease } from '../types';
import { StatusBadge } from './StatusBadge';
import { UserProfileMenu } from './UserProfileMenu';
import { USERS } from '../data/mock';

interface Props {
  onSelectVehicle: (vehicleId: string) => void;
  onNewHold: () => void;
  onRegisterAndFlag: (prefill?: string) => void;
}

export function Dashboard({ onSelectVehicle, onNewHold, onRegisterAndFlag }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, loading } = useGarage();
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Nav */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-yellow-400 dark:bg-yellow-500 rounded flex items-center justify-center transition-colors">
            <span className="text-black font-bold text-xs">FG</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">Fleet Garage</span>
        </div>
        <div className="flex items-center gap-3">
          <UserProfileMenu />
        </div>
      </nav>

      <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
            <p className="text-2xl font-bold text-red-600 dark:text-red-500">{held}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Currently Held</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
            <p className="text-2xl font-bold text-amber-500">{onException}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">On Exception</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">{preExisting}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pre-existing</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
            <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{returned}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Returned</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
            <p className="text-2xl font-bold text-green-600 dark:text-green-500">{cleared}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Repaired</p>
          </div>
        </div>

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
    </div>
  );
}
