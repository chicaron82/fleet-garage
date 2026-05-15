import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadFleet } from '../lib/fleet-master';
import type { FleetVehicle, FleetStatus } from '../lib/fleet-master';
import type { Screen } from '../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  onRegisterNew: (prefill?: string) => void;
  refreshKey?: number;
}

const COLLAPSED_BY_DEFAULT = new Set<FleetStatus>(['clear']);

const STATUS_GROUPS: { status: FleetStatus; label: string; dot: string; badgeClass: string; headerClass: string }[] = [
  { status: 'held',         label: 'Held',         dot: '🔴', badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',       headerClass: 'text-red-700 dark:text-red-400' },
  { status: 'pre-existing', label: 'Pre-existing',  dot: '🟡', badgeClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40', headerClass: 'text-yellow-700 dark:text-yellow-400' },
  { status: 'on-exception', label: 'On Exception',  dot: '🟠', badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/40', headerClass: 'text-orange-700 dark:text-orange-400' },
  { status: 'dirty',        label: 'Dirty',         dot: '🟤', badgeClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',   headerClass: 'text-amber-700 dark:text-amber-400' },
  { status: 'available',    label: 'Available',     dot: '🟢', badgeClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',  headerClass: 'text-green-700 dark:text-green-400' },
  { status: 'clear',        label: 'Clear',         dot: '⚪', badgeClass: 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',           headerClass: 'text-gray-600 dark:text-gray-400' },
];

function fmtRelative(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function FleetMasterView({ onNavigate, onRegisterNew, refreshKey }: Props) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<FleetStatus>>(new Set(COLLAPSED_BY_DEFAULT));

  useEffect(() => {
    if (!user?.branchId) return;
    setLoading(true);
    loadFleet(user.branchId).then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, [user?.branchId, refreshKey]);

  const term = search.trim().toUpperCase();
  const filtered = term
    ? vehicles.filter(v =>
        v.licensePlate.toUpperCase().includes(term) ||
        (v.unitNumber?.toUpperCase() ?? '').includes(term)
      )
    : vehicles;

  const toggleCollapsed = (status: FleetStatus) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading fleet…</p>
      </div>
    );
  }

  const noMatch = !!term && filtered.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Fleet</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 tabular-nums">
            {vehicles.length} vehicles
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRegisterNew()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
        >
          + Add Vehicle
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search plate or unit…"
        value={search}
        onChange={e => setSearch(e.target.value.toUpperCase())}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
      />

      {/* No match — register CTA */}
      {noMatch && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-6 text-center space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No vehicle found for <span className="font-semibold text-gray-700 dark:text-gray-300">{term}</span>
          </p>
          <button
            type="button"
            onClick={() => onRegisterNew(term)}
            className="text-xs font-medium text-yellow-600 dark:text-yellow-400 underline underline-offset-2 cursor-pointer"
          >
            + Register this vehicle
          </button>
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-12 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">No vehicles registered for this branch yet.</p>
          <button
            type="button"
            onClick={() => onRegisterNew()}
            className="text-xs font-medium text-yellow-600 dark:text-yellow-400 underline underline-offset-2 cursor-pointer"
          >
            + Add your first vehicle
          </button>
        </div>
      )}

      {/* Grouped list */}
      {!noMatch && vehicles.length > 0 && (
        <div className="space-y-3">
          {STATUS_GROUPS.map(({ status, label, dot, badgeClass, headerClass }) => {
            const group = filtered.filter(v => v.status === status);
            if (group.length === 0) return null;
            const isCollapsed = collapsed.has(status);
            return (
              <div key={status} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(status)}
                  className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">{dot}</span>
                    <span className={`text-sm font-semibold ${headerClass}`}>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{group.length}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{isCollapsed ? '▶' : '▼'}</span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                    {group.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onNavigate({ name: 'vehicle', vehicleId: v.id })}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${badgeClass}`}>
                            {label}
                          </span>
                          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 shrink-0">{v.licensePlate}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">·</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{v.unitNumber}</span>
                          <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto whitespace-nowrap truncate">
                            {v.make} {v.model} {v.year} · {v.color}
                          </span>
                        </div>
                        {(status === 'held' || status === 'pre-existing' || status === 'on-exception') && v.holdSummary.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              Hold: {v.holdSummary.join(', ')}{v.holdFlaggedAt ? ` · Flagged ${fmtRelative(v.holdFlaggedAt)}` : ''}
                            </p>
                            {v.holdCount > 1 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">
                                {v.holdCount} holds
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
