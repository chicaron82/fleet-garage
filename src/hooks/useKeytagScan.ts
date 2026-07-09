// The read → resolve → stage engine behind an inline key-tag scan. Fed a photo (base64),
// it reads the tag (make/model resolved server-side), matches the fleet (resolveKeytagScan),
// and exposes the result for <ScanBranch> to render, plus register() to stage a new vehicle.
// Decoupled from the capture UI so the L&F modal can drive it from its Step-1 key-tag photo
// (the photo does double duty: attached to the record AND read to fill the plate).
// See docs/ticket-misc-effie-keytag-scan.md.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { usePendingWrites } from './usePendingWrites';
import { resolveKeytagScan, newVehicleFromRead, type KeytagScanResult } from '../lib/resolveKeytagScan';
import { buildRegisterVehicleProposal, buildUpdateVehicleProposal } from '../../api/_lib/holdProposal';
import type { KeytagRead } from '../../api/_lib/keytagRead';

export interface KeytagScanState {
  scan: { read: KeytagRead; result: KeytagScanResult } | null;
  staged: boolean;
  err: string;
  reading: boolean;
  /** Read + resolve a key-tag photo; `onPlate` fills the plate field with the corrected plate. */
  scanPhoto: (base64: string, onPlate?: (plate: string) => void) => Promise<void>;
  register: () => Promise<void>;
  backfill: () => Promise<void>;
  reset: () => void;
}

export function useKeytagScan(): KeytagScanState {
  const { readKeytag, status } = useKeytagRead();
  const { vehicles } = useVehicleHoldContext();
  const { stage } = usePendingWrites();
  const [scan, setScan] = useState<{ read: KeytagRead; result: KeytagScanResult } | null>(null);
  const [staged, setStaged] = useState(false);
  const [err, setErr] = useState('');

  const scanPhoto = useCallback(async (base64: string, onPlate?: (plate: string) => void) => {
    setScan(null); setStaged(false); setErr('');
    const read = await readKeytag(base64);
    if (!read) { setErr('Could not read that key tag.'); return; }
    const result = resolveKeytagScan(read, vehicles);
    setScan({ read, result });
    if (result.plate) onPlate?.(result.plate);
  }, [readKeytag, vehicles]);

  const register = useCallback(async () => {
    if (!scan) return;
    const nv = newVehicleFromRead(scan.read, scan.result.plate);
    if (!nv) return;
    setErr('');
    const ok = await stage(buildRegisterVehicleProposal(nv, nv.make === 'Tesla'), 'keytag-scan');
    if (ok) setStaged(true); else setErr('Could not stage — try again.');
  }, [scan, stage]);

  const backfill = useCallback(async () => {
    if (!scan || scan.result.resolution.kind !== 'partial' || !scan.result.vehicle) return;
    setErr('');
    const proposal = buildUpdateVehicleProposal(scan.result.vehicle.id, scan.result.plate, scan.result.resolution.fills);
    const ok = await stage(proposal, 'keytag-scan');
    if (ok) setStaged(true); else setErr('Could not stage — try again.');
  }, [scan, stage]);

  const reset = useCallback(() => { setScan(null); setStaged(false); setErr(''); }, []);

  return { scan, staged, err, reading: status === 'reading', scanPhoto, register, backfill, reset };
}
