import { useState } from 'react';
import { keyOptionsFor, keyNoun } from '../../lib/keyCount';
import { OdometerCapture } from '../shared/OdometerCapture';
import { ScanEvAssets } from './ScanEvAssets';
import type { Vehicle } from '../../types';
import type { EvSource } from '../../types';

// WHAT HE CAN RECORD WHILE STANDING AT THE CAR — keys, EV kit, odometer.
//
// Extracted from ScanRouterOverlay 2026-08-26 when the EV row took that file to 335 against the
// hard 330. The cap did its job: it turned "this file is long" into a module rather than into
// deleted documentation. And the three belong together for a reason beyond size — they are the
// same beat. He has the tag in his hand, the trunk open and the dash lit, and each of them is a
// fact he can only supply from exactly there.
export function ScanVehicleCapture({ vehicle, scanNonce, recordKeyCount, recordOdometer, updateVehicleEVAssets }: {
  vehicle: Vehicle;
  scanNonce: number;
  recordKeyCount: (vehicleId: string, n: number) => Promise<void>;
  recordOdometer: (vehicleId: string, km: number) => Promise<void>;
  updateVehicleEVAssets: (
    vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean, source: EvSource, notes?: string,
  ) => Promise<boolean>;
}) {
  const [savingEv, setSavingEv] = useState(false);

  return (
    <>
                    {/* Key count surfaced HERE, tag in hand — not hidden behind opening the unit. If
                        it's unlogged, log the baseline right now (the moment of truth), so a future
                        short return is detectable. (ticket-scan-keycount-surface.)
                        
                        ⭐ THE ROW STAYS AFTER IT'S SET, with the current value lit. It used to
                        collapse into static text the moment he tapped — so a mis-tap (gloves, cold,
                        moving) could only be undone by leaving the card and opening the vehicle.
                        The correction path vanished at exactly the moment it was needed.
                        Aaron, 2026-08-18: *"sometimes I tap the wrong count so have to open it up
                        to edit the key count number."*
                        
                        He also floated a confirmation step. Deliberately NOT built: it taxes the
                        CORRECT path — the overwhelming majority of taps — to insure against the
                        rare wrong one, and it contradicts the header's own rule that "scanning is
                        one tap, not two". With gloves, a confirm dialog is just one more small
                        target between him and done. **Make the mistake cheap instead of making the
                        action expensive.** */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {vehicle.isTesla ? '⚡' : '🔑'} {vehicle.keyCount != null
                          ? `${vehicle.keyCount} ${keyNoun(vehicle.isTesla, vehicle.keyCount)} —`
                          : vehicle.isTesla ? 'Keycard not logged —' : 'Keys not logged —'}
                      </span>
                      <div className="flex gap-2">
                        {/* A Tesla carries exactly ONE keycard, so 2/3/4 are questions with no true
                            answer — and this row is tapped with gloves on. Offering only the real
                            option removes the mis-tap instead of asking him to avoid it. */}
                        {keyOptionsFor(vehicle.isTesla).map(n => (
                          <button key={n} type="button" onClick={() => void recordKeyCount(vehicle.id, n)}
                            aria-pressed={vehicle.keyCount === n}
                            aria-label={`${n} key${n === 1 ? '' : 's'} on the ring`}
                            /* 44px — the Apple/Google minimum touch target. This was 24px, which is
                               half the standard, spaced 4px apart, tapped with nitrile gloves on. */
                            className={`w-11 h-11 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                              vehicle.keyCount === n
                                ? 'bg-fg-yellow border-fg-yellow text-black'
                                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100'
                            }`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
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
                          void updateVehicleEVAssets(vehicle.id, cable, adapter, 'vsa_washbay')
                            .finally(() => setSavingEv(false));
                        }}
                      />
                    )}
                    {/* The odometer, in the same beat as the key count — he is at the dash. Until
                        now this column had ONE writer (the airport flip) and stood at 0 of 683. */}
                    <OdometerCapture
                      vehicleId={vehicle.id}
                      resetKey={scanNonce}
                      currentKm={vehicle.odometer}
                      currentAt={vehicle.odometerAt}
                      onSave={recordOdometer}
                    />
    </>
  );
}
