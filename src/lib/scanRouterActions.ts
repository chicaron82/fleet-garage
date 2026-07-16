// The context-aware action menu for the universal scan-router: given a resolved key-tag scan,
// which actions make sense + where each routes. Pure — the whole "smart menu" lives here so the
// overlay just renders the list and navigates on tap (thin-hub law: resolve + route, the modules
// do the work). Never offers "register" for a car already on record, or a vehicle action for one
// FG doesn't know. The routes reuse existing Screen prefill (register-vehicle/new-hold/vehicle)
// plus the new prefillPlate on lost-and-found/movement-log.
import { newVehicleFromRead } from './resolveKeytagScan';
import type { KeytagScanResult } from './resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Screen } from '../types';

export type ScanActionKind = 'register' | 'register-and-flag' | 'view' | 'flag' | 'lnf' | 'trip';

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
export function scanRouterActions(read: KeytagRead, result: KeytagScanResult): ScanAction[] {
  const { plate, vehicle } = result;
  if (!plate) return [];

  const logLostFound: ScanAction = {
    kind: 'lnf', label: 'Log lost & found', icon: '📦',
    screen: { name: 'lost-and-found', prefillPlate: plate },
  };

  // On record → act on the known vehicle.
  if (vehicle) {
    const who = vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : plate;
    return [
      { kind: 'view', label: `View ${who}`, icon: '🔎', screen: { name: 'vehicle', vehicleId: vehicle.id } },
      { kind: 'flag', label: 'Flag / hold', icon: '🔧', screen: { name: 'new-hold', vehicleId: vehicle.id } },
      logLostFound,
      { kind: 'trip', label: 'Start trip', icon: '🚗', screen: { name: 'movement-log', prefillPlate: plate } },
    ];
  }

  // New to the fleet → register (only if the tag read enough), else just Lost & Found.
  const actions: ScanAction[] = [];
  if (newVehicleFromRead(read, plate)) {
    actions.push({ kind: 'register', label: 'Register', icon: '➕', screen: { name: 'register-vehicle', prefill: plate } });
    actions.push({ kind: 'register-and-flag', label: 'Register & flag', icon: '🔧', screen: { name: 'register-vehicle', fromHold: true, prefill: plate } });
  }
  actions.push(logLostFound);
  return actions;
}
