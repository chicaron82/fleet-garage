// Closing inventory — scan the tag, mark the status. Step 3 of the closing checklist.
//
// ⚠️⚠️ IT SUPPLEMENTS THE PAPER, IT DOES NOT REPLACE IT. Aaron: *"if I happen to close I'll use it.
// it's not a replacement. just another method of doing things."* Other people close, and they close
// on paper — so this has to be useful on the nights he does it, with nobody else adopting anything.
//
// ⭐ Collapsed by default, like its neighbours. Most nights he is not closing.
import { useMemo, useRef, useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useKeytagScan } from '../../hooks/useKeytagScan';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useClosingInventory } from '../../hooks/useClosingInventory';
import { PhotoError } from '../shared/PhotoError';
import { ClosingInventoryCard, ClosingInventoryExclusion } from './ClosingInventoryCard';
import { ClosingInventorySheet } from './ClosingInventorySheet';
import { exclusionReason, type ActiveHold, type InventoryEntry } from '../../lib/closingInventory';

export function ClosingInventorySection() {
  const [open, setOpen] = useState(false);
  /** Only his EDITS live in state. The row itself is derived from the scan, every render. */
  const [edits, setEdits] = useState<Partial<InventoryEntry>>({});
  const [overrodeExclusion, setOverrode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { getActiveHolds } = useVehicleHoldContext();
  const { scan, scanPhoto, reading, reset } = useKeytagScan();
  const { photoError, takeOne } = usePhotoIntake();
  const { entries, tally, addScan, commit, removeAt, clear } = useClosingInventory();

  /**
   * ⭐ The pending row is DERIVED from the scan, not copied into state by an effect.
   *
   * ⚠️ The first version used a `useEffect` to turn a resolved scan into state and ESLint refused
   * it — correctly. Deriving is not just the lint-clean shape, it is the right one: a copy can go
   * stale against the scan it came from, and this cannot. His edits layer on top.
   */
  const built = useMemo(() => {
    const vehicle = scan?.result.vehicle;
    if (!vehicle) return null;
    const holds = getActiveHolds(vehicle.id) as unknown as ActiveHold[];
    // ⭐ The sale / turnback / buy-back question is asked ONCE, through the hold — not by type.
    return { ...addScan(vehicle, holds), excluded: exclusionReason(holds) };
  }, [scan, getActiveHolds, addScan]);

  const pendingEntry: InventoryEntry | null = built ? { ...built.entry, ...edits } : null;
  /** A tag that read fine but names no fleet car — say so; the paper still takes it. */
  const notInFleet = !!scan && !scan.result.vehicle;

  function done() {
    setEdits({});
    setOverrode(false);
    reset();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const base64 = await takeOne(file);
    if (base64) await scanPhoto(base64);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          📋 Closing Inventory
          {entries.length > 0 && (
            <span className="ml-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">
              {entries.length} written up
            </span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Form 8073-16, PM. Supplements the paper — the tag fills four columns, you decide the status.
          </p>

          <PhotoError message={photoError} />
          {notInFleet && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              ⚠️ {scan?.result.plate || 'That tag'} isn't in the fleet — write it on the paper.
            </p>
          )}

          {built && pendingEntry && built.excluded && !overrodeExclusion ? (
            <ClosingInventoryExclusion plate={pendingEntry.plate} reason={built.excluded}
              onSkip={done} onAnyway={() => setOverrode(true)} />
          ) : built && pendingEntry ? (
            <ClosingInventoryCard entry={pendingEntry} why={built.why} suggestedRow={built.suggestedRow}
              onChange={patch => setEdits(e => ({ ...e, ...patch }))}
              onAdd={() => { commit(pendingEntry); done(); }}
              onSkip={done} />
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
              {/* ⚠️ bg-fg-yellow + 📷 IS THE SCAN GESTURE, not a style choice. Every "Scan Key Tag" in
                  FG wears the brand accent (62 files), and Aaron is trained on it — a differently
                  coloured button in a new section makes him READ it instead of recognising it.
                  The first cut here was bg-blue-600, which appears nowhere else in My Shift. */}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-sm font-semibold py-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition">
                <span className="text-base leading-none">📷</span>
                {reading ? 'Reading tag…' : 'Scan a key tag'}
              </button>
            </>
          )}

          <ClosingInventorySheet entries={entries} tally={tally} onRemove={removeAt} />

          {entries.length > 0 && (
            <button type="button" onClick={clear}
              className="text-[11px] text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition">
              Clear the sheet
            </button>
          )}
        </div>
      )}
    </div>
  );
}
