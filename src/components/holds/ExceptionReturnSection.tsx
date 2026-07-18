import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useReEval } from '../../hooks/useReEval';
import { useUserResolver } from '../../hooks/useUserResolver';
import { HoldContextPanel } from './HoldContextPanel';
import { DetailReEvalCard } from './DetailReEvalCard';
import { isOnExceptionStatus } from '../../lib/vehicle-status';
import type { Hold, HoldType, User, Vehicle } from '../../types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Geotab-install exceptions ride the same OUT_ON_EXCEPTION machinery as damage returns, but they
// ask a DIFFERENT question on return ("unit installed yet?" not "any new damage?"). They can also
// outnumber the real damage/condition returns many-to-one, so they get their own lens below the
// condition returns instead of burying them. Keyed on the hold description (the preset's label).
const GEOTAB_HOLD_DESC = 'Geotab not installed';

// One unified exception-return surface. Every vehicle let out on exception
// surfaces here once, routed by the kind of hold that drove the exception:
//   detail (cleaning) holds → re-evaluation actions (confirm / clear / re-hold / escalate)
//   damage / mechanical / auction holds → photo-comparison re-hold via HoldContextPanel
// Detail holds are excluded from the damage branch so a cleaning exception never
// shows the (wrong) damage re-hold forms.
type ExceptionItem =
  | { kind: 'detail'; vehicle: Vehicle; hold: Hold }
  | { kind: 'damage'; vehicle: Vehicle; hold: Hold; isAuction: boolean };

interface Props { search?: string; }

export function ExceptionReturnSection({ search = '' }: Props) {
  const { user } = useAuth();
  const { vehicles, holds, getHoldsForVehicle, addHold } = useVehicleHoldContext();
  const re = useReEval();
  const [open, setOpen] = useState(false);

  const items = useMemo<ExceptionItem[]>(() => {
    // Detail-hold exception returns (mirrors useReEval's filter)
    const detail: ExceptionItem[] = holds
      .filter(h =>
        (h.status === 'RELEASED' || h.status === 'RETURNED') &&
        h.holdType === 'detail' && !!h.detailReason &&
        h.release?.releaseType === 'EXCEPTION'
      )
      .map(h => ({ hold: h, vehicle: vehicles.find(v => v.id === h.vehicleId) }))
      .filter((x): x is { hold: Hold; vehicle: Vehicle } =>
        !!x.vehicle && (x.vehicle.status === 'OUT_ON_EXCEPTION' || x.vehicle.status === 'RETURNED')
      )
      .map(x => ({ kind: 'detail', vehicle: x.vehicle, hold: x.hold }));

    // Damage / auction exception returns — non-detail exception holds on vehicles
    // still out (mirrors the prior ExceptionReturnSection behaviour)
    const damage: ExceptionItem[] = vehicles
      .filter(v => isOnExceptionStatus(v.status))
      .flatMap(v => {
        const hold = getHoldsForVehicle(v.id).find(h =>
          h.status === 'RELEASED' &&
          h.release?.releaseType === 'EXCEPTION' &&
          h.holdType !== 'detail'
        );
        return hold
          ? [{ kind: 'damage' as const, vehicle: v, hold, isAuction: v.status === 'AUCTION_SHORT_TERM' }]
          : [];
      });

    return [...detail, ...damage];
  }, [holds, vehicles, getHoldsForVehicle]);

  const matchesSearch = (v: Vehicle) => {
    const q = search.toUpperCase();
    return (v.unitNumber?.toUpperCase() ?? '').includes(q) ||
      v.licensePlate.toUpperCase().includes(q) ||
      v.make.toUpperCase().includes(q) ||
      v.model.toUpperCase().includes(q);
  };

  const visibleItems = search.trim() ? items.filter(item => matchesSearch(item.vehicle)) : items;
  // Split the two populations: real condition returns vs geotab-install exceptions.
  const visibleGeotab  = visibleItems.filter(i => i.hold.damageDescription === GEOTAB_HOLD_DESC);
  const visibleReturns = visibleItems.filter(i => i.hold.damageDescription !== GEOTAB_HOLD_DESC);

  const renderItem = (item: ExceptionItem) =>
    item.kind === 'detail' ? (
      <DetailReEvalCard key={item.hold.id} item={{ hold: item.hold, vehicle: item.vehicle }} re={re} />
    ) : (
      <DamageReturnCard
        key={item.hold.id}
        vehicle={item.vehicle}
        hold={item.hold}
        isAuction={item.isAuction}
        allHolds={getHoldsForVehicle(item.vehicle.id)}
        user={user}
        onReHold={async (vehicleId, description, notes, photos, linkedHoldId, holdTypes) => {
          if (!user) return;
          await addHold(vehicleId, description, notes, user.id, photos, holdTypes, undefined, undefined, linkedHoldId);
        }}
      />
    );

  // Auto-expand when search matches an exception vehicle
  useEffect(() => {
    if (!search.trim()) return;
    const q = search.toUpperCase();
    const hasMatch = items.some(item => {
      const v = item.vehicle;
      return (v.unitNumber?.toUpperCase() ?? '').includes(q) ||
        v.licensePlate.toUpperCase().includes(q) ||
        v.make.toUpperCase().includes(q) ||
        v.model.toUpperCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasMatch) setOpen(true);
  }, [search, items]);

  if (items.length === 0) return null;
  // Search is active but no exceptions match — don't distract from the vehicle list
  if (search.trim() && visibleItems.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Collapsible header / count chip */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 transition-colors text-left cursor-pointer"
      >
        <div>
          <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Exception Returns</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Compare against the hold record — re-hold if anything is new or worse.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">
            {visibleReturns.length}{visibleGeotab.length > 0 ? ` +📡${visibleGeotab.length}` : ''}
          </span>
          <svg
            className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <>
          {visibleReturns.map(renderItem)}
          {visibleGeotab.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 px-1">
                📡 Geotab installs · hold until the unit&apos;s in ({visibleGeotab.length})
              </p>
              {visibleGeotab.map(renderItem)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Damage / auction return card ─────────────────────────────────────────────

function DamageReturnCard({ vehicle, hold, isAuction, allHolds, user, onReHold }: {
  vehicle: Vehicle;
  hold: Hold;
  isAuction: boolean;
  allHolds: Hold[];
  user: User | null;
  onReHold: (vehicleId: string, description: string, notes: string, photos: string[], linkedHoldId: string, holdTypes: HoldType[]) => Promise<void>;
}) {
  const { getName } = useUserResolver();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-hidden transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{vehicle.unitNumber}</span>
              <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{vehicle.licensePlate}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}
            </p>
            <div className="mt-2 bg-gray-50 dark:bg-gray-950 rounded-lg px-3 py-2 space-y-1 transition-colors">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors">{hold.damageDescription}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                Flagged {fmtDate(hold.flaggedAt)} · {getName(hold.flaggedById)}
              </p>
              {hold.release && (
                <p className="text-xs text-amber-600 dark:text-amber-400 transition-colors">
                  Released: {hold.release.reason}
                </p>
              )}
            </div>
          </div>
          {isAuction ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 transition-colors">
              Auction
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors">
              On Exception
            </span>
          )}
        </div>

        {isAuction && (
          <div className="mt-3 px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg text-xs text-purple-800 dark:text-purple-300">
            This unit is flagged for auction. Re-hold as Sale Car below.
          </div>
        )}

        {user && (
          <HoldContextPanel
            vehicle={vehicle}
            holds={allHolds}
            user={user}
            onReHold={onReHold}
            reHoldContext={isAuction ? 'auction' : 'exception'}
          />
        )}
      </div>
    </div>
  );
}
