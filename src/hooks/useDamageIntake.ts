// The read → resolve → read-damage → stage engine behind the "Log damage" drop-n-go. Fed two
// photos (key tag + damage), it reads the tag (make/model resolved server-side), matches the
// fleet, reads the damage into a draft description, and stages the branch-correct hold-bearing
// proposal (register_and_hold / hold / update_and_hold) with the damage photo attached — for
// Aaron to approve later on My Shift. Decoupled from the capture UI (LogDamageModal drives it).
// See docs/ticket-effie-damage-drop-intake.md.
import { useCallback, useState } from 'react';
import { useKeytagRead } from './useKeytagRead';
import { useDamageRead } from './useDamageRead';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { usePendingWritesContext } from '../context/PendingWritesContext';
import { resolveKeytagScan, type KeytagScanResult } from '../lib/resolveKeytagScan';
import { buildDamageIntakeProposal } from '../lib/damageIntakeProposal';
import type { KeytagRead } from '../../api/_lib/keytagRead';

export interface DamageIntakeState {
  scan: { read: KeytagRead; result: KeytagScanResult } | null;
  scanning: boolean;
  scanErr: string;
  scanKeytag: (base64: string) => Promise<void>;

  damagePhoto: string | null;
  reading: boolean;
  readErr: string;
  readDamagePhoto: (base64: string) => Promise<void>;
  description: string;
  setDescription: (s: string) => void;

  staged: boolean;
  staging: boolean;
  stageErr: string;
  /** True once both a resolved tag AND a damage photo are in hand. */
  canStage: boolean;
  submit: () => Promise<void>;

  reset: () => void;
}

export function useDamageIntake(): DamageIntakeState {
  const { readKeytag, status: keytagStatus } = useKeytagRead();
  const { readDamage, status: damageStatus } = useDamageRead();
  const { vehicles } = useVehicleHoldContext();
  const { stage } = usePendingWritesContext();

  const [scan, setScan] = useState<{ read: KeytagRead; result: KeytagScanResult } | null>(null);
  const [scanErr, setScanErr] = useState('');
  const [damagePhoto, setDamagePhoto] = useState<string | null>(null);
  const [readErr, setReadErr] = useState('');
  const [description, setDescription] = useState('');
  const [staged, setStaged] = useState(false);
  const [staging, setStaging] = useState(false);
  const [stageErr, setStageErr] = useState('');

  const scanKeytag = useCallback(async (base64: string) => {
    setScan(null); setScanErr('');
    const read = await readKeytag(base64);
    if (!read) { setScanErr('Could not read that key tag — try a clearer photo.'); return; }
    setScan({ read, result: resolveKeytagScan(read, vehicles) });
  }, [readKeytag, vehicles]);

  const readDamagePhoto = useCallback(async (base64: string) => {
    setDamagePhoto(base64); setReadErr('');
    const dmg = await readDamage(base64);
    if (dmg?.description) setDescription(dmg.description);
    else if (!dmg) setReadErr('Could not read the damage — describe it below.');
  }, [readDamage]);

  const submit = useCallback(async () => {
    if (!scan || !damagePhoto) return;
    setStageErr('');
    const block = buildDamageIntakeProposal(scan.read, scan.result, description.trim());
    if (!block.ok) {
      setStageErr("Couldn't read enough of the tag to register this vehicle — add it via Effie chat first, then hold.");
      return;
    }
    setStaging(true);
    const ok = await stage(block.proposal, 'log-damage', [damagePhoto]);
    setStaging(false);
    if (ok) setStaged(true); else setStageErr('Could not stage — check connection and try again.');
  }, [scan, damagePhoto, description, stage]);

  const reset = useCallback(() => {
    setScan(null); setScanErr(''); setDamagePhoto(null); setReadErr('');
    setDescription(''); setStaged(false); setStaging(false); setStageErr('');
  }, []);

  return {
    scan, scanning: keytagStatus === 'reading', scanErr, scanKeytag,
    damagePhoto, reading: damageStatus === 'reading', readErr, readDamagePhoto, description, setDescription,
    staged, staging, stageErr, canStage: !!scan && !!damagePhoto, submit, reset,
  };
}
