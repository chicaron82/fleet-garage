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
import { resolveKeytagScan, type KeytagScanResult } from '../lib/resolveKeytagScan';
import { buildRegisterVehicleProposal, type NewVehicle } from '../../api/_lib/holdProposal';
import type { KeytagRead } from '../../api/_lib/keytagRead';

/** A read complete enough to register from (the identity essentials) → a NewVehicle, else null. */
export function newVehicleFromRead(read: KeytagRead, plate: string): NewVehicle | null {
  if (!read.make || !read.model || !read.unitNumber || !read.year) return null;
  return { unitNumber: read.unitNumber, plate, make: read.make, model: read.model, year: read.year, color: read.color ?? '' };
}

export interface KeytagScanState {
  scan: { read: KeytagRead; result: KeytagScanResult } | null;
  staged: boolean;
  err: string;
  reading: boolean;
  /** Read + resolve a key-tag photo; `onPlate` fills the plate field with the corrected plate. */
  scanPhoto: (base64: string, onPlate?: (plate: string) => void) => Promise<void>;
  register: () => Promise<void>;
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

  const reset = useCallback(() => { setScan(null); setStaged(false); setErr(''); }, []);

  return { scan, staged, err, reading: status === 'reading', scanPhoto, register, reset };
}
