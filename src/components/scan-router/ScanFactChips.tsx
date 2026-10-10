import { VehicleKeyChip } from '../vehicle/VehicleKeyChip';
import { SaveNote } from '../shared/SaveNote';
import { useWriteGuard } from '../../hooks/useWriteGuard';
import { describeOdometerAge } from '../../lib/odometer';
import type { Vehicle } from '../../types';

// THE FACTS HE READS OFF THE CARD AT A GLANCE — key count and tires, one row under the status line.
//
// ⭐ Aaron, 2026-10-10 (docs/October/ticket-scan-card-header-chips.md): *"Move key count above damage
// map. Show key count as a tap to edit like the vehicle record. I accidentally changed the count on
// some cars when scrolling. Show me if it has winter tires."*
//
// The key count has now been two shapes on this card, and both complaints were his and both right:
//   • 2026-08-18 — it collapsed to text once set, so fixing a mis-tap meant leaving the card. It
//     became four always-live buttons.
//   • 2026-10-10 — four always-live write buttons sat in the path of his thumb, below a tall damage
//     map he scrolls past. The change log shows five cars flipped and flipped back inside a minute.
// The chip answers both: the correction is still on the card, and nothing writes on the first tap.
// ⚠️ The rule this card now follows: on a scroll path, a stray tap may OPEN or NAVIGATE, never WRITE.
//
// ❄️ SHOWN, NOT FLIPPED — his ruling the same morning. On the record the tire chip flips in one tap;
// here that would be the same accident as the key row, so the scan card only reports it. ☀️ is the
// fleet's resting state (see VehicleRecordFacts), so it stays a bare mark; ❄️ is the exception worth
// words, and carries its date because winters are a fact that ages.
export function ScanFactChips({ vehicle, scanNonce, recordKeyCount }: {
  vehicle: Vehicle;
  /** A new scan closes an open picker — the next car must not inherit the last one's open editor. */
  scanNonce: number;
  recordKeyCount: (vehicleId: string, n: number) => Promise<void>;
}) {
  // `recordKeyCount` THROWS on a failed write — see docs/September/ticket-writes-that-vanish-into-void.md.
  const { writeError, guard } = useWriteGuard();

  return (
    <>
    {/* ⚠️ NEVER WRAPS. Open, the picker is ~290px of a ~330px row; "❄️ Winter tires · 2d ago" beside
        it wrapped to a second line and pushed the map down 24px under his thumb (measured on
        LZM542, 2026-10-10). The tire text gives way instead — it truncates while he is mid-edit. */}
    <div className="flex items-center gap-2 mt-1.5" data-testid="scan-fact-chips">
      <div className="shrink-0">
      <VehicleKeyChip
        key={`${vehicle.id}:${scanNonce}`}
        touch
        isTesla={vehicle.isTesla}
        keyCount={vehicle.keyCount}
        onPick={n => guard(() => recordKeyCount(vehicle.id, n), "That didn't save — tap it again.")}
      />
      </div>
      {vehicle.winterTires ? (
        <span className="min-w-0 truncate text-xs font-semibold text-sky-800 dark:text-sky-300">
          ❄️ Winter tires
          {vehicle.winterTiresAt && <span className="font-normal opacity-70"> · {describeOdometerAge(vehicle.winterTiresAt)}</span>}
        </span>
      ) : (
        <span className="text-sm" role="img" aria-label="No winter tires marked">☀️</span>
      )}
    </div>
    <SaveNote message={writeError} />
    </>
  );
}
