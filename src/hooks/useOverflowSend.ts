// Client-side "log overflow sends" (Movement Log): pick a spot, scan a stack of key tags, and
// log one completed one-way trip each — registering an unknown car (or backfilling a partial)
// from the read as it goes, so the sends aren't orphans (the gap the Effie-chat overflow can't
// close, since its tool only carries plates). The per-scan decision is the pure planOverflowScan;
// this hook owns the fleet writes + the trip writes + the staged list.
//
// ⭐ Takes ONE photo or a STACK (`scanPhotos`), because a stack is the shape of the job — see the
// note on `scanPhotos` for why that is the whole point of this surface existing.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useAuth } from '../context/AuthContext';
import { writeOrEnqueue } from '../lib/vsaTripWrite';
import { buildOverflowTrip } from '../lib/overflowTrip';
import { planOverflowScan } from '../lib/overflowScan';
import { resolveKeytagScan } from '../lib/resolveKeytagScan';
import type { Vehicle } from '../types';
import type { OverflowDestination } from '../../api/_lib/overflowProposal';

export interface OverflowSend {
  plate: string;
  unit: string | null;
  label: string;
  /** How the scan touched the fleet — drives the row badge. */
  status: 'registered' | 'backfilled' | 'known' | 'unregistered';
  /** ⭐ The RECORD the tag resolved to, so the row can notice a re-plate. Null for a car FG has no
   *  record of. Aaron, 2026-09-06: *"anything that involves scanning a tag that picks it up should
   *  work the same when it finds something"* — and a send is the surface that keys its trip on the
   *  PLATE STRING (`vehicle_plate`), so a stale plate here logs a trip against a car FG cannot find. */
  vehicle: Vehicle | null;
}

export function useOverflowSend(onLogged?: () => void) {
  const { readKeytag, status } = useKeytagRead();
  const { vehicles, addVehicle, updateVehicleFields, attachKeytagPhotoIfMissing } = useVehicleHoldContext();
  const { user } = useAuth();
  const [destination, setDestination] = useState<OverflowDestination>('Airport');
  const [sends, setSends] = useState<OverflowSend[]>([]);
  const [logging, setLogging] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  /**
   * One photo, planned against `known` — the fleet PLUS anything registered earlier in this same
   * batch. Returns the stub of a car it minted so the caller can extend `known`.
   *
   * ⚠️⚠️ THE STALE-CLOSURE HAZARD IS WHY `known` IS A PARAMETER. `vehicles` is captured when this
   * callback is built, so every iteration of a batch would otherwise plan against the fleet as it
   * looked BEFORE the first photo. Two tags for the same new car in one stack would each resolve
   * "new" and register it twice. Threading the growing list through is what makes a loop safe;
   * awaiting the context refresh would not, since the closure never sees it.
   */
  const scanOne = useCallback(async (base64: string, known: Vehicle[]): Promise<Vehicle | null> => {
    const read = await readKeytag(base64);
    if (!read) { setErr('Could not read that key tag.'); return null; }
    const plan = planOverflowScan(read, known);
    if (!plan) { setErr('No plate on that tag — log it in Effie chat instead.'); return null; }
    // Do the fleet write up front (identity is in hand), then stage the send.
    let sendStatus: OverflowSend['status'] = 'known';
    // The vehicle this scan touched — for universal keytag capture (attach the tag if it lacks one).
    let vehicleId: string | undefined;
    // A car minted by THIS photo, handed back so the batch can plan the next one against it.
    let minted: Vehicle | null = null;
    if (plan.register && user) {
      const nv = plan.register;
      try {
        vehicleId = await addVehicle({
          unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model,
          year: nv.year, color: nv.color, rentalClass: nv.rentalClass ?? null, branchId: user.branchId, isTesla: nv.make === 'Tesla',
          hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR',
        });
        sendStatus = 'registered';
        if (vehicleId) {
          minted = {
            id: vehicleId, unitNumber: nv.unitNumber ?? null, licensePlate: nv.plate,
            make: nv.make ?? '', model: nv.model ?? '', year: nv.year ?? 0, color: nv.color ?? '',
            status: 'CLEAR', branchId: user.branchId,
            isTesla: nv.make === 'Tesla', hasMobileCable: null, hasJ1772Adapter: null,
          } as Vehicle;
        }
      } catch { sendStatus = 'unregistered'; }
    } else if (plan.backfill) {
      vehicleId = plan.backfill.vehicleId;
      try { await updateVehicleFields(plan.backfill.vehicleId, plan.backfill.applies); sendStatus = 'backfilled'; }
      catch { sendStatus = 'known'; }
    } else if (plan.unregistered) {
      sendStatus = 'unregistered';
    } else {
      // Plain known car (nothing to register or fill) — still a capture opportunity.
      vehicleId = resolveKeytagScan(read, known).vehicle?.id;
    }
    // Universal keytag capture: save the tag to the car it touched if that car has none. If-missing.
    if (vehicleId) void attachKeytagPhotoIfMissing(vehicleId, base64);
    setSends(prev => [...prev, { ...plan.send, status: sendStatus, vehicle: resolveKeytagScan(read, known).vehicle }]);
    return minted;
  }, [readKeytag, addVehicle, updateVehicleFields, attachKeytagPhotoIfMissing, user]);

  /** One photo, the single-scan entry point. */
  const scanPhoto = useCallback(async (base64: string) => {
    setErr('');
    await scanOne(base64, vehicles);
  }, [scanOne, vehicles]);

  /**
   * ⭐⭐ A STACK OF TAGS, WHICH IS THE SHAPE OF THE JOB. Aaron, 2026-09-08, on why he used the
   * Effie chat (which reads a tag and keeps only the plate) instead of this form:
   * *"i went for the chat because I could send multiple in one go."*
   *
   * He did not pick the lossy path over the lossless one — he picked the only one shaped like a
   * stack of key tags, and nothing told him what that cost. This is the same engine, run in a loop,
   * so the batch route stops being the one that throws the read away.
   */
  const scanPhotos = useCallback(async (base64s: string[]) => {
    if (base64s.length === 0) return;
    setErr('');
    setScanProgress({ done: 0, total: base64s.length });
    const known = [...vehicles];
    for (let i = 0; i < base64s.length; i++) {
      const minted = await scanOne(base64s[i], known);
      if (minted) known.push(minted);   // ⭐ so photo i+1 plans against it
      setScanProgress({ done: i + 1, total: base64s.length });
    }
    setScanProgress(null);
  }, [scanOne, vehicles]);

  const remove = useCallback((index: number) => setSends(prev => prev.filter((_, i) => i !== index)), []);

  const logSends = useCallback(async () => {
    if (!user || sends.length === 0) return;
    setLogging(true); setErr('');
    const nowMs = Date.now();
    let allOk = true;
    for (let i = 0; i < sends.length; i++) {
      const trip = buildOverflowTrip({ plate: sends[i].plate, unit: sends[i].unit }, destination, user.id, user.branchId, nowMs, i);
      const { ok } = await writeOrEnqueue('insert', trip);
      if (!ok) allOk = false;
    }
    setLogging(false);
    if (!allOk) { setErr('Could not log all sends — check connection and try again.'); return; }
    setToast(`✓ Logged ${sends.length} send${sends.length === 1 ? '' : 's'} → ${destination}`);
    setTimeout(() => setToast(null), 3000);
    setSends([]);
    onLogged?.();
  }, [user, sends, destination, onLogged]);

  const reset = useCallback(() => { setSends([]); setErr(''); }, []);

  return {
    destination, setDestination, sends, reading: status === 'reading', logging, err, toast,
    scanProgress, scanPhoto, scanPhotos, remove, logSends, reset,
  };
}
