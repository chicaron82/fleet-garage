import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { canRelease } from '../types';
import { StatusBadge } from './StatusBadge';
import { USERS } from '../data/mock';

interface Props {
  onSelectVehicle: (vehicleId: string) => void;
  onNewHold: () => void;
  onRegisterAndFlag: () => void;
}

export function Dashboard({ onSelectVehicle, onNewHold, onRegisterAndFlag }: Props) {
  const { user, logout } = useAuth();
  const { vehicles, holds, loading } = useGarage();
  const [search, setSearch] = useState('');

  const held = vehicles.filter(v => v.status === 'HELD').length;
  const onException = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;
  const returned = vehicles.filter(v => v.status === 'RETURNED').length;

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
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-yellow-400 rounded flex items-center justify-center">
            <span className="text-black font-bold text-xs">FG</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Fleet Garage</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-gray-900">{user!.name}</p>
            <p className="text-xs text-gray-400">{user!.role} · {user!.employeeId}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-700 transition cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{held}</p>
            <p className="text-xs text-gray-500 mt-0.5">Currently Held</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{onException}</p>
            <p className="text-xs text-gray-500 mt-0.5">On Exception</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{returned}</p>
            <p className="text-xs text-gray-500 mt-0.5">Returned</p>
          </div>
        </div>

        {/* Search + Add Hold */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search unit #, plate, make…"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
          />
          <button
            onClick={onNewHold}
            className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            + Flag Vehicle
          </button>
        </div>

        {/* Management banner */}
        {canRelease(user!.role) && onException > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            ⚠️ <strong>{onException}</strong> vehicle{onException > 1 ? 's are' : ' is'} currently out on exception and may need a return follow-up.
          </div>
        )}

        {/* Vehicle List */}
        <div className="space-y-2">
          {loading && (
            <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
          )}
          {filtered.map(vehicle => {
            const latestHold = getLatestHold(vehicle.id);
            return (
              <button
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle.id)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-yellow-400 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{vehicle.unitNumber}</span>
                      <span className="text-gray-400 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{vehicle.licensePlate}</span>
                    </div>
                    <p className="text-sm text-gray-600">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
                    {latestHold && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate">
                        {latestHold.damageDescription.slice(0, 60)}{latestHold.damageDescription.length > 60 ? '…' : ''}
                      </p>
                    )}
                    {latestHold && (
                      <p className="text-xs text-gray-400 mt-0.5">
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
                onClick={onRegisterAndFlag}
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
