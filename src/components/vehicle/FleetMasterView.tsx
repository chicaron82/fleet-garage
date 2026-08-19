import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { PrimaryAction } from '../shared/PrimaryAction';
import { loadFleet, matchesFleetSearch } from '../../lib/fleet-master';
import type { FleetVehicle, FleetStatus } from '../../lib/fleet-master';
import { fleetCohortCounts, matchesCohort, type FleetCohortId } from '../../lib/fleetCohorts';
import { FleetHealthChips } from './FleetHealthChips';
import { FleetAuditPanel } from './FleetAuditPanel';
import { useFleetAudit } from '../../hooks/useFleetAudit';
import { useFleetTrend } from '../../hooks/useFleetTrend';
import { cohortDeltas, describeBaseline, registeredOn, toLocalDate } from '../../lib/fleetTrend';
import type { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
  onRegisterNew: (prefill?: string) => void;
  refreshKey?: number;
}

const COLLAPSED_BY_DEFAULT = new Set<FleetStatus>(['clear']);

const STATUS_GROUPS: { status: FleetStatus; label: string; dot: string; badgeClass: string; headerClass: string }[] = [
  { status: 'held',               label: 'Held',               dot: '🔴', badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',           headerClass: 'text-red-700 dark:text-red-400' },
  { status: 'pre-existing',       label: 'Pre-existing',       dot: '🟡', badgeClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40', headerClass: 'text-yellow-700 dark:text-yellow-400' },
  { status: 'on-exception',       label: 'On Exception',       dot: '🟠', badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/40', headerClass: 'text-orange-700 dark:text-orange-400' },
  { status: 'sale-car',           label: 'Sale Car',           dot: '🏷️', badgeClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/40',         headerClass: 'text-teal-700 dark:text-teal-400' },
  { status: 'auction-short-term', label: 'Auction — Short Term', dot: '🔖', badgeClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40', headerClass: 'text-purple-700 dark:text-purple-400' },
  { status: 'dirty',              label: 'Dirty',              dot: '🟤', badgeClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',     headerClass: 'text-amber-700 dark:text-amber-400' },
  { status: 'available',          label: 'Available',          dot: '🟢', badgeClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40',    headerClass: 'text-green-700 dark:text-green-400' },
  { status: 'clear',              label: 'Clear',              dot: '⚪', badgeClass: 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',             headerClass: 'text-gray-600 dark:text-gray-400' },
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
  const [cohort, setCohort] = useState<FleetCohortId | null>(null);
  const [collapsed, setCollapsed] = useState<Set<FleetStatus>>(new Set(COLLAPSED_BY_DEFAULT));

  useEffect(() => {
    if (!user?.branchId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadFleet(user.branchId).then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, [user?.branchId, refreshKey]);

  const term = search.trim().toUpperCase();
  // Cohort counts are the whole-fleet PULSE — always over the full loaded set, never narrowed by
  // the search box (search finds a car; the chips report fleet health).
  const cohortCounts = fleetCohortCounts(vehicles);
  const filtered = vehicles.filter(v => matchesFleetSearch(v, term) && matchesCohort(v, cohort));

  // ── Movement, not just level ────────────────────────────────────────────────────────────────
  // Two different sources, and the split is the point (see fleetTrend.ts / migration 115):
  // registrations are real history off created_at and work from day one; the cohort arrows need a
  // stored baseline and appear from the second snapshot onward.
  const audit = useFleetAudit(vehicles, user?.branchId);

  const baseline = useFleetTrend({
    branchId: user?.branchId ?? '', counts: cohortCounts, total: vehicles.length, ready: !loading && vehicles.length > 0,
  });
  const todayISO = toLocalDate(new Date());
  const deltas = cohortDeltas(cohortCounts, baseline);
  const sinceLabel = describeBaseline(baseline?.snapshotDate, todayISO);
  const createdStamps = vehicles.map(v => v.createdAt);
  const addedToday = registeredOn(createdStamps, todayISO);

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
      <ModuleHeader
        title="Fleet"
        subtitle={`${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} registered`}
      />

      {/* Search + add */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search plate, unit, or class (e.g. Q4)…"
          value={search}
          onChange={e => setSearch(e.target.value.toUpperCase())}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
        />
        <PrimaryAction label="Add Vehicle" aria-label="Register a vehicle" onClick={() => onRegisterNew()} />
      </div>

      {/* Records that contradict each other — silent unless there are any. Sits ABOVE the health
          chips deliberately: a chip counts a GAP (no key count yet), this counts a CONTRADICTION,
          and a contradiction is the one FG can be actively wrong about. */}
      <FleetAuditPanel findings={audit.findings} loaded={audit.loaded} onDismiss={audit.dismiss} onNavigate={onNavigate} />

      {/* Fleet-health pulse — tappable chips filter the list to each gap */}
      {vehicles.length > 0 && (
        <FleetHealthChips total={vehicles.length} counts={cohortCounts} active={cohort} onSelect={setCohort} deltas={deltas} />
      )}

      {/* The trend line. Registrations are an ACTIVITY, not a gap, so they get a line rather than a
          chip — there is nothing to filter the list down to. The "since" phrase names the real
          baseline date, so a gap in snapshots reads as a gap instead of a confident "yesterday". */}
      {vehicles.length > 0 && (addedToday > 0 || sinceLabel) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          {addedToday > 0 && (
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              ➕ {addedToday} registered today
            </span>
          )}
          {addedToday > 0 && sinceLabel && <span> · </span>}
          {sinceLabel && <span>arrows {sinceLabel}</span>}
        </p>
      )}

      {/* No match — register CTA */}
      {noMatch && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-6 text-center space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No vehicle found for <span className="font-semibold text-gray-700 dark:text-gray-300">{term}</span>
          </p>
          <PrimaryAction label="Register this vehicle" onClick={() => onRegisterNew(term)} />
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-12 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">No vehicles registered for this branch yet.</p>
          <PrimaryAction label="Add your first vehicle" onClick={() => onRegisterNew()} />
        </div>
      )}

      {/* Grouped list */}
      {!noMatch && vehicles.length > 0 && (
        <div className="space-y-3">
          {STATUS_GROUPS.map(({ status, label, dot, badgeClass, headerClass }) => {
            const group = filtered.filter(v => v.status === status);
            if (group.length === 0) return null;
            // A search term OR an active cohort expands every group — otherwise the collapsed
            // Clear group (where most cars live) would hide the very cohort you just tapped.
            const isCollapsed = (term || cohort) ? false : collapsed.has(status);
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
                    {group.map(v => {
                      const isTesla        = v.isTesla || v.make.toLowerCase() === 'tesla';
                      const evBothMissing  = isTesla && v.hasMobileCable === false && v.hasJ1772Adapter === false;
                      const evOneMissing   = isTesla && !evBothMissing && (v.hasMobileCable === false || v.hasJ1772Adapter === false);
                      const evBorderClass  = evBothMissing ? 'border-l-4 border-l-red-500' : evOneMissing ? 'border-l-4 border-l-amber-400' : '';
                      return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onNavigate({ name: 'vehicle', vehicleId: v.id })}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer ${evBorderClass}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${badgeClass}`}>
                            {label}
                          </span>
                          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 shrink-0">{v.licensePlate}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">·</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{v.unitNumber}</span>
                          {v.rentalClass && (
                            <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 dark:text-indigo-300 shrink-0">
                              {v.rentalClass}
                            </span>
                          )}
                          {isTesla && (
                            <span className={`text-[10px] font-bold shrink-0 ${evBothMissing ? 'text-red-500' : evOneMissing ? 'text-amber-500' : 'text-blue-400'}`}>
                              ⚡
                            </span>
                          )}
                          {v.isHybrid && (
                            <span className="text-[10px] font-bold shrink-0 text-green-500" title="Hybrid">🔋</span>
                          )}
                          <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto whitespace-nowrap truncate">
                            {v.make} {v.model} {v.year} · {v.color}
                          </span>
                        </div>
                        {(status === 'held' || status === 'pre-existing' || status === 'on-exception' || status === 'sale-car' || status === 'auction-short-term') && v.holdSummary.length > 0 && (
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
                      );
                    })}
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
