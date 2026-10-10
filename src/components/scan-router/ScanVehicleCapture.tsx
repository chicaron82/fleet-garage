import { useState } from 'react';
import { useWriteGuard } from '../../hooks/useWriteGuard';
import { SaveNote } from '../shared/SaveNote';
import { OdometerCapture } from '../shared/OdometerCapture';
import { ScanEvAssets } from './ScanEvAssets';
import { ScanFlipCapture } from './ScanFlipCapture';
import type { Vehicle } from '../../types';
import type { EvSource } from '../../types';

// WHAT HE CAN RECORD WHILE STANDING AT THE CAR — EV kit, odometer, the flip.
// (The key count lived here until 2026-10-10; it is a chip under the status line now — ScanFactChips.)
//
// Extracted from ScanRouterOverlay 2026-08-26 when the EV row took that file to 335 against the
// hard 330. The cap did its job: it turned "this file is long" into a module rather than into
// deleted documentation. And the three belong together for a reason beyond size — they are the
// same beat. He has the tag in his hand, the trunk open and the dash lit, and each of them is a
// fact he can only supply from exactly there.
export function ScanVehicleCapture({ vehicle, scanNonce, rentalClass, recordOdometer, clearOdometer, correctOdometer, updateVehicleEVAssets }: {
  vehicle: Vehicle;
  scanNonce: number;
  /** Rental class off THIS tag read; the flip list tallies classes turned around. */
  rentalClass: string;
  recordOdometer: (vehicleId: string, km: number) => Promise<void>;
  updateVehicleEVAssets: (
    vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean, source: EvSource, notes?: string,
  ) => Promise<boolean>;
  /** Back to "not logged" — the wrong-car mix-up happens AT the scan, so the escape belongs here. */
  clearOdometer: (vehicleId: string) => Promise<boolean>;
  correctOdometer: (vehicleId: string, km: number) => Promise<boolean>;
}) {
  const [savingEv, setSavingEv] = useState(false);
  // A failed EV write says so instead of vanishing (docs/September/ticket-writes-that-vanish-into-void.md).
  const { writeError, guard } = useWriteGuard();

  return (
    <>
                    {/* The EV kit, in the same beat as the keycard — he already has the trunk open.
                        Teslas only: on a gas car these are questions with no true answer, and this
                        row is tapped with gloves on. `source: 'vsa_washbay'` because that is where
                        he is standing; the same provenance the EV tab records. */}
                    {vehicle.isTesla && (
                      <ScanEvAssets
                        vehicle={vehicle}
                        saving={savingEv}
                        onSet={(cable, adapter) => {
                          setSavingEv(true);
                          void guard(
                            () => updateVehicleEVAssets(vehicle.id, cable, adapter, 'vsa_washbay'),
                            "The EV check didn't save — tap it again.",
                          ).finally(() => setSavingEv(false));
                        }}
                      />
                    )}
                    <SaveNote message={writeError} />
                    {/* The odometer — he is at the dash. Until
                        now this column had ONE writer (the airport flip) and stood at 0 of 683. */}
                    <OdometerCapture
                      isUs={vehicle.isUs}
                      vehicleId={vehicle.id}
                      resetKey={scanNonce}
                      currentKm={vehicle.odometer}
                      currentAt={vehicle.odometerAt}
                      onSave={recordOdometer}
                      onClear={clearOdometer}
                      onCorrect={correctOdometer}
                    />
                    {/* ⭐ LAST in the beat, and that order is the argument: everything above is
                        already captured, so the flip only has to ask for what this sheet does not
                        know — fuel and a note. Aaron, 2026-08-26: "odo/keys already captured. so
                        add a button to flip which captures fuel via slider and notes." */}
                    <ScanFlipCapture vehicle={vehicle} rentalClass={rentalClass} />
    </>
  );
}
