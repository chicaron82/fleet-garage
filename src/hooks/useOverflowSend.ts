// Client-side "log overflow sends" (Movement Log): pick a spot, scan a stack of key tags, and
// log one completed one-way trip each — registering an unknown car (or backfilling a partial)
// from the read as it goes, so the sends aren't orphans (the gap the Effie-chat overflow can't
// close, since its tool only carries plates). The per-scan decision is the pure planOverflowScan;
// this hook owns the fleet writes + the trip writes + the staged list.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useAuth } from '../context/AuthContext';
import { writeOrEnqueue } from '../lib/vsaTripWrite';
import { buildOverflowTrip } from '../lib/overflowTrip';
import { planOverflowScan } from '../lib/overflowScan';
import type { OverflowDestination } from '../../api/_lib/overflowProposal';

export interface OverflowSend {
  plate: string;
  unit: string | null;
  label: string;
  /** How the scan touched the fleet — drives the row badge. */
  status: 'registered' | 'backfilled' | 'known' | 'unregistered';
}

export function useOverflowSend(onLogged?: () => void) {
  const { readKeytag, status } = useKeytagRead();
  const { vehicles, addVehicle, updateVehicleFields } = useVehicleHoldContext();
  const { user } = useAuth();
  const [destination, setDestination] = useState<OverflowDestination>('Airport');
  const [sends, setSends] = useState<OverflowSend[]>([]);
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const scanPhoto = useCallback(async (base64: string) => {
    setErr('');
    const read = await readKeytag(base64);
    if (!read) { setErr('Could not read that key tag.'); return; }
    const plan = planOverflowScan(read, vehicles);
    if (!plan) { setErr('No plate on that tag — log it in Effie chat instead.'); return; }
    // Do the fleet write up front (identity is in hand), then stage the send.
    let sendStatus: OverflowSend['status'] = 'known';
    if (plan.register && user) {
      const nv = plan.register;
      try {
        await addVehicle({
          unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model,
          year: nv.year, color: nv.color, branchId: user.branchId, isTesla: nv.make === 'Tesla',
          hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR',
        });
        sendStatus = 'registered';
      } catch { sendStatus = 'unregistered'; }
    } else if (plan.backfill) {
      try { await updateVehicleFields(plan.backfill.vehicleId, plan.backfill.fills); sendStatus = 'backfilled'; }
      catch { sendStatus = 'known'; }
    } else if (plan.unregistered) {
      sendStatus = 'unregistered';
    }
    setSends(prev => [...prev, { ...plan.send, status: sendStatus }]);
  }, [readKeytag, vehicles, addVehicle, updateVehicleFields, user]);

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
    scanPhoto, remove, logSends, reset,
  };
}
