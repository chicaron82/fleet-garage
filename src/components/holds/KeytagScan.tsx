// Inline key-tag scan for a plate field: snap a tag → the read resolves to a full vehicle
// (make/model server-side) → normalize the plate + match the fleet → fill the field + show
// the branch. NEW → offer to register (staged into the pending queue, log-and-go). COMPLETE
// → it's already in the fleet, here's what we know. PARTIAL → in the fleet, the tag adds
// fields (backfill staging is a follow-on — needs an update-vehicle proposal kind).
// The misread guard: an MB-prefix snap is shown before offering to register a "new" plate.
// See docs/ticket-misc-effie-keytag-scan.md.
import { useRef, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { usePendingWrites } from '../../hooks/usePendingWrites';
import { resolveKeytagScan, type KeytagScanResult } from '../../lib/resolveKeytagScan';
import { buildRegisterVehicleProposal, describeNewVehicle, type NewVehicle } from '../../../api/_lib/holdProposal';
import { compressImage } from '../../lib/image';
import type { KeytagRead } from '../../../api/_lib/keytagRead';

/** A read complete enough to register from (the identity essentials) → a NewVehicle, else null. */
function newVehicleFromRead(read: KeytagRead, plate: string): NewVehicle | null {
  if (!read.make || !read.model || !read.unitNumber || !read.year) return null;
  return { unitNumber: read.unitNumber, plate, make: read.make, model: read.model, year: read.year, color: read.color ?? '' };
}

export function KeytagScan({ onPlate }: { onPlate: (plate: string) => void }) {
  const { readKeytag, status } = useKeytagRead();
  const { vehicles } = useVehicleHoldContext();
  const { stage } = usePendingWrites();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<{ read: KeytagRead; result: KeytagScanResult } | null>(null);
  const [staged, setStaged] = useState(false);
  const [err, setErr] = useState('');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScan(null); setStaged(false); setErr('');
    const read = await readKeytag(await compressImage(file));
    if (!read) { setErr('Could not read that key tag.'); return; }
    const result = resolveKeytagScan(read, vehicles);
    setScan({ read, result });
    if (result.plate) onPlate(result.plate); // fill the field
  };

  const doRegister = async () => {
    if (!scan) return;
    const nv = newVehicleFromRead(scan.read, scan.result.plate);
    if (!nv) return;
    setErr('');
    const ok = await stage(buildRegisterVehicleProposal(nv, nv.make === 'Tesla'), 'keytag-scan');
    if (ok) setStaged(true); else setErr('Could not stage — try again.');
  };

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={status === 'reading'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 cursor-pointer"
      >
        <span className="text-sm leading-none">📷</span>
        {status === 'reading' ? 'Reading tag…' : 'Scan key tag'}
      </button>

      {err && <p className="text-xs text-red-500">{err}</p>}
      {scan && <ScanBranch scan={scan} staged={staged} onRegister={doRegister} />}
    </div>
  );
}

export function ScanBranch({ scan, staged, onRegister }: {
  scan: { read: KeytagRead; result: KeytagScanResult };
  staged: boolean;
  onRegister: () => void;
}) {
  const { read, result } = scan;
  const { plate, wasCorrected, rawPlate, vehicle, resolution } = result;

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm">
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
          <span className="font-mono font-semibold">{plate}</span> — Unit {vehicle.unitNumber}, {vehicle.year} {vehicle.make} {vehicle.model}. Already in the fleet.
        </p>
      )}

      {resolution.kind === 'partial' && vehicle && (
        <div className="space-y-0.5">
          <p className="text-gray-700 dark:text-gray-200">
            <span className="font-mono font-semibold">{plate}</span> — Unit {vehicle.unitNumber}, in the fleet.
          </p>
          {resolution.fills.length > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              The tag adds: {resolution.fills.map(f => `${f.field} ${f.value}`).join(', ')}.
            </p>
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
