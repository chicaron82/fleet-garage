// The context-aware action menu for the universal scan-router: given a resolved key-tag scan,
// which actions make sense + where each routes. Pure — the whole "smart menu" lives here so the
// overlay just renders the list and navigates on tap (thin-hub law: resolve + route, the modules
// do the work). Never offers "register" for a car already on record, or a vehicle action for one
// FG doesn't know. The routes reuse existing Screen prefill (register-vehicle/new-hold/vehicle)
// plus the new prefillPlate on lost-and-found/movement-log.
import { newVehicleFromRead } from './resolveKeytagScan';
import { scannedFromRead, canRegisterPartially } from './partialRegister';
import type { KeytagScanResult } from './resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Screen } from '../types';

export type ScanActionKind = 'register' | 'register-and-flag' | 'view' | 'flag' | 'lnf' | 'trip' | 'repair';

export interface ScanAction {
  kind: ScanActionKind;
  label: string;
  icon: string;
  /** Where a tap routes — the target module, pre-filled with this vehicle. */
  screen: Screen;
}

/**
 * The actions to offer for a resolved scan. `read` is needed to know whether a NEW car was read
 * completely enough to register (else only Lost & Found makes sense). Returns [] for an unreadable
 * tag (no plate) — the overlay shows the read error instead.
 */
/**
 * @param hasActiveHold — true when the scanned car is currently held. Adds the "Mark repaired"
 *   route so a car he's standing at with the damage in front of him is one tap from its repair
 *   action instead of a landing-at-the-top-of-the-record detour (Aaron, 2026-08-16).
 *   ⚠️ It is a ROUTE, not a write: the overlay still only routes, and the vehicle module performs
 *   its own action. That's what keeps the thin-hub law intact rather than bent.
 */
export function scanRouterActions(read: KeytagRead, result: KeytagScanResult, scanNonce: number, hasActiveHold = false): ScanAction[] {
  const { plate, vehicle } = result;
  if (!plate) return [];

  // scanNonce stamps the plate-prefill routes so a repeat scan of the SAME tag is a distinct
  // routing event — without it the value-keyed re-seed at the destination fires once and a
  // second scan silently no-ops (empty field / sheet won't reopen). See Screen.prefillNonce.
  const logLostFound: ScanAction = {
    kind: 'lnf', label: 'Log lost & found', icon: '📦',
    screen: { name: 'lost-and-found', prefillPlate: plate, prefillNonce: scanNonce },
  };

  // On record → act on the known vehicle.
  if (vehicle) {
    const who = vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : plate;
    return [
      // Repair first when the car is held — it's the reason he's most likely standing there with
      // the tag. `openRepairNonce` makes a repeat scan a distinct routing event, same as the
      // prefill nonces: without it a second scan of the same tag would no-op at the destination.
      ...(hasActiveHold
        ? [{ kind: 'repair' as const, label: 'Mark repaired / done', icon: '✓',
             screen: { name: 'vehicle' as const, vehicleId: vehicle.id, openRepair: true, openRepairNonce: scanNonce } }]
        : []),
      { kind: 'view', label: `View ${who}`, icon: '🔎', screen: { name: 'vehicle', vehicleId: vehicle.id } },
      { kind: 'flag', label: 'Flag / hold', icon: '🔧', screen: { name: 'new-hold', vehicleId: vehicle.id, prefillNonce: scanNonce } },
      logLostFound,
      { kind: 'trip', label: 'Start trip', icon: '🚗', screen: { name: 'movement-log', prefillPlate: plate, prefillNonce: scanNonce, autoStart: true } },
    ];
  }

  // New to the fleet → register (only if the tag read enough), else just Lost & Found.
  const actions: ScanAction[] = [];
  // The tag was read completely enough to register — so carry EVERY field through, not just the
  // plate. Passing `prefill` alone made the operator retype make/model/unit/year that FG had
  // just read off the tag in his hand (found live 2026-07-17). `newVehicleFromRead` non-null IS
  // the proof the fields exist; throwing them away here was the bug.
  const nv = newVehicleFromRead(read, plate);
  if (nv) {
    // scannedFromRead builds the same identity object (it's what the partial path below uses)
    // and carries every tag field including rentalClass — no hand-rolled subset to drift.
    const scanned = scannedFromRead(read, plate);
    actions.push({ kind: 'register', label: 'Register', icon: '➕', screen: { name: 'register-vehicle', prefill: plate, scanned } });
    actions.push({ kind: 'register-and-flag', label: 'Register & flag', icon: '🔧', screen: { name: 'register-vehicle', fromHold: true, prefill: plate, scanned } });
  } else if (canRegisterPartially(read, plate)) {
    // The class code missed the codex (a new model — CDGT/Durango, 2026-07-19), so make/model are
    // empty. Everything ELSE on the tag read fine, and discarding all of it left the operator with
    // nothing but Lost & Found on a car he needed to hold. Offer the same routes, pre-filled with
    // what was read, and say plainly which two fields he has to add. Degrade, never dead-end.
    const scanned = scannedFromRead(read, plate);
    actions.push({ kind: 'register', label: 'Register — add make/model', icon: '➕', screen: { name: 'register-vehicle', prefill: plate, scanned } });
    actions.push({ kind: 'register-and-flag', label: 'Register & flag — add make/model', icon: '🔧', screen: { name: 'register-vehicle', fromHold: true, prefill: plate, scanned } });
  }
  actions.push(logLostFound);
  return actions;
}
