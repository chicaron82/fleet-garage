// The branch UI for a resolved key-tag scan — rendered wherever a scan happens (today: the
// Lost & Found log modal, driven by its Step-1 key-tag photo via useKeytagScan). NEW → offer
// to register (staged, log-and-go); COMPLETE → already in the fleet; PARTIAL → the tag adds
// fields (backfill staging is a follow-on). Misread guard: a corrected MB prefix shows its
// show-your-work first. Pure props — the read/resolve/stage lives in useKeytagScan.
// See docs/ticket-misc-effie-keytag-scan.md.
import { describeNewVehicle } from '../../../api/_lib/holdProposal';
import { VehicleName } from '../shared/VehicleName';
import { newVehicleFromRead, type KeytagScanResult } from '../../lib/resolveKeytagScan';
import { KeytagReplateOffer } from '../scan-router/KeytagReplateOffer';
import { PlateShapeHint } from '../scan-router/PlateShapeHint';
import type { KeytagRead } from '../../../api/_lib/keytagRead';

export function ScanBranch({ scan, staged, onRegister, onBackfill, scanNonce }: {
  scan: { read: KeytagRead; result: KeytagScanResult };
  staged: boolean;
  onRegister: () => void;
  onBackfill: () => void;
  /** Bumped per read (`useKeytagScan().nonce`) so a dismissed re-plate offer re-arms on a new scan. */
  scanNonce: string | number;
}) {
  const { read, result } = scan;
  const { plate, wasCorrected, rawPlate, vehicle, resolution } = result;

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm">
      {/* ⭐⭐ Aaron, 2026-09-06: *"anything that involves scanning a tag that picks it up should work
          the same when it finds something"*. This branch resolves the car by its UNIT when the plate
          is unknown — which is exactly what a re-plated car looks like — and used to say nothing
          about the disagreement. Lost & Found matters most here: it keys its row on the plate
          STRING, so a re-plated car produced an item attached to a plate FG knows no vehicle for. */}
      <KeytagReplateOffer vehicle={vehicle} tagPlate={plate} scanNonce={scanNonce} />
      {wasCorrected && rawPlate && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Read <span className="font-mono">{rawPlate}</span> → corrected to <span className="font-mono font-semibold">{plate}</span>
        </p>
      )}

      {resolution.kind === 'new' && (() => {
        const nv = newVehicleFromRead(read, plate);
        if (staged) return <p className="text-green-700 dark:text-green-400">✓ Staged {plate} to register — approve on My Shift.</p>;
        return (
          <div className="space-y-1.5">
            <p className="text-gray-700 dark:text-gray-200"><span className="font-mono font-semibold">{plate}</span> — not in the fleet.</p>
            {/* ⭐⭐⭐ ABOVE THE REGISTER BUTTON ON PURPOSE — this is where the duplicates were BORN.
                `fleetAudit`'s own header records two of them: unit 5421656 entered twice as LUR143
                and LURL43, unit 5738117 as 0EJ761 and OEJ761 — "one car each, entered twice off a
                SINGLE MISREAD CHARACTER", both sitting in the live fleet for months. The audit
                catches that AFTER the fact; this is the same knowledge arriving BEFORE the tap that
                creates it. A hint here is worth more than a finding a month later. */}
            <PlateShapeHint plate={plate} owningArea={read.owningArea} />
            {nv ? (
              <button type="button" onClick={onRegister} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
                Register {describeNewVehicle(nv)}
              </button>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Couldn't read enough to register (need make/model/unit/year) — add it via Effie chat.</p>
            )}
          </div>
        );
      })()}

      {resolution.kind === 'complete' && vehicle && (
        <p className="text-gray-700 dark:text-gray-200">
          <span className="font-mono font-semibold">{plate}</span> — Unit {vehicle.unitNumber}, <VehicleName vehicle={vehicle} />. Already in the fleet.
        </p>
      )}

      {resolution.kind === 'partial' && vehicle && (
        <div className="space-y-1.5">
          <p className="text-gray-700 dark:text-gray-200">
            <span className="font-mono font-semibold">{plate}</span> — Unit {vehicle.unitNumber}, in the fleet.
          </p>
          {resolution.fills.length > 0 && (
            staged ? (
              <p className="text-green-700 dark:text-green-400">✓ Staged the backfill — approve on My Shift.</p>
            ) : (
              <>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  The tag adds: {resolution.fills.map(f => `${f.field} ${f.value}`).join(', ')}.
                </p>
                <button type="button" onClick={onBackfill} className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
                  Fill in {resolution.fills.map(f => f.field).join(', ')}
                </button>
              </>
            )
          )}
          {resolution.conflicts.length > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Disagrees on: {resolution.conflicts.map(c => `${c.field} (tag ${c.read} vs ${c.existing})`).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
