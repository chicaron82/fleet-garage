import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useReEval } from '../../hooks/useReEval';
import { useUserResolver } from '../../hooks/useUserResolver';
import { HoldContextPanel } from './HoldContextPanel';
import { DetailReEvalCard } from './DetailReEvalCard';
import type { Hold, HoldType, User, Vehicle } from '../../types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// One unified exception-return surface. Every vehicle let out on exception
// surfaces here once, routed by the kind of hold that drove the exception:
//   detail (cleaning) holds → re-evaluation actions (confirm / clear / re-hold / escalate)
//   damage / mechanical / auction holds → photo-comparison re-hold via HoldContextPanel
// Detail holds are excluded from the damage branch so a cleaning exception never
// shows the (wrong) damage re-hold forms.
type ExceptionItem =
  | { kind: 'detail'; vehicle: Vehicle; hold: Hold }
  | { kind: 'damage'; vehicle: Vehicle; hold: Hold; isAuction: boolean };

export function ExceptionReturnSection() {
  const { user } = useAuth();
  const { vehicles, holds, getHoldsForVehicle, addHold } = useVehicleHoldContext();
  const re = useReEval();

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
      .filter(v => v.status === 'OUT_ON_EXCEPTION' || v.status === 'AUCTION_SHORT_TERM')
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

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 transition-colors">
        <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
          Exception Returns — {items.length} vehicle{items.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Compare against the hold record — re-hold if anything is new or worse. Detail holds re-evaluate; auction units re-hold as Sale Car.
        </p>
      </div>

      {items.map(item =>
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
        )
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
