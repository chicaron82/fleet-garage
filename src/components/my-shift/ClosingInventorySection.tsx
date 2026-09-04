// Closing inventory — scan the tag, mark the status. Step 3 of the closing checklist.
//
// ⚠️⚠️ IT SUPPLEMENTS THE PAPER, IT DOES NOT REPLACE IT. Aaron: *"if I happen to close I'll use it.
// it's not a replacement. just another method of doing things."* Other people close, and they close
// on paper — so this has to be useful on the nights he does it, with nobody else adopting anything.
//
// ⭐ Collapsed by default, like its neighbours. Most nights he is not closing.
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useRegisterOnScan } from '../../hooks/useRegisterOnScan';
import { useKeytagScan } from '../../hooks/useKeytagScan';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useClosingInventory } from '../../hooks/useClosingInventory';
import { useShareText } from '../../hooks/useShareText';
import { PhotoError } from '../shared/PhotoError';
import { ScanButton } from '../shared/ScanButton';
import { Toast } from '../shared/Toast';
import { VehicleLookup } from '../shared/VehicleLookup';
import { ShareTextButton } from '../shared/ShareTextButton';
import { buildInventoryReport } from '../../lib/closingInventoryReport';
import { ClosingInventoryCard, ClosingInventoryExclusion } from './ClosingInventoryCard';
import { ClosingInventorySheet } from './ClosingInventorySheet';
import { ClosingInventoryStrip } from './ClosingInventoryStrip';
import { businessDateOf } from '../../lib/shiftDay';
import { exclusionReason, type ActiveHold, type InventoryEntry } from '../../lib/closingInventory';

/**
 * The lot this write-up covers. FG is branch-scoped (YWG), but the closing inventory is specifically
 * the ERIN ST washbay lot — and the counter thinks in places, not branch codes.
 */
const LOT_NAME = 'Erin St';

/**
 * "Sep 3" — enough date for the top of an emailed block.
 *
 * ⚠️ The BUSINESS date, not the calendar one: a write-up finished after midnight still belongs to
 * the shift that did it, which is the whole reason `shiftDay` exists.
 */
function shortDate(): string {
  const [y, mo, d] = businessDateOf(new Date()).split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function ClosingInventorySection() {
  const [open, setOpen] = useState(false);
  /** Only his EDITS live in state. The row itself is derived from the scan, every render. */
  const [edits, setEdits] = useState<Partial<InventoryEntry>>({});
  const [overrodeExclusion, setOverrode] = useState(false);
  /** A plate he typed because the tag would not read — resolved against the fleet, not assumed new. */
  const [typed, setTyped] = useState('');
  /** A row already on the sheet, being corrected in place. */
  const [editing, setEditing] = useState<{ index: number; entry: InventoryEntry } | null>(null);

  const { copied, share } = useShareText();
  const { user } = useAuth();
  const { getActiveHolds, vehicles, addVehicle, updateVehicleFields } = useVehicleHoldContext();
  /**
   * ⭐⭐ REUSED, NOT REBUILT. Aaron: *"use already what exists for registrating tags FG hasn't seen
   * before."* This hook already syncs the fleet from a movement scan — *"a NEW plate is registered
   * from the read, an ON-RECORD-but-PARTIAL one has its blank fields backfilled"* — and it exists
   * because a trip was once logged against a car FG did not know (LUR315, 2026-07-15).
   *
   * ⭐ A sheet row against an unknown car is the same orphan, and the closing write-up is where the
   * genuinely new cars turn up: the ones that arrived BEFORE his shift. It no-ops on a known car and
   * on a read too partial to mint a record, so wiring it costs nothing on the other 56 tags.
   */
  const { registerToast, handleScanRead } = useRegisterOnScan({ vehicles, addVehicle, updateVehicleFields, user });
  const { scan, scanPhoto, reading, reset } = useKeytagScan();
  const { photoError, takeOne } = usePhotoIntake();
  const {
    entries, tally, counts, carriedStatus, carriedRow,
    addScan, addTag, commit, updateAt, removeAt, undoLast, clear,
  } = useClosingInventory();

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

  /**
   * ⭐⭐ A tag that read fine but names no fleet car STILL BECOMES A ROW. Aaron: *"why wouldn't FG
   * just record the tag anyway. then it just becomes something to fully register at another point in
   * time."* The scan already holds owning area, unit, licence and class; the sheet has slots for all
   * four and has never needed a `vehicles` record.
   */
  const fromTag = useMemo(() => {
    if (!scan || scan.result.vehicle || !scan.result.plate) return null;
    return { ...addTag({
      plate: scan.result.plate,
      owningArea: scan.read.owningArea,
      unitNumber: scan.read.unitNumber,
      rentalClass: scan.read.rentalClass,
      model: scan.read.model,
    }), excluded: null };
  }, [scan, addTag]);

  /**
   * ⭐⭐ A TYPED PLATE IS LOOKED UP, NOT ASSUMED NEW. Aaron, 2026-09-04: *"sure hand entry, but should
   * also look up if FG holds it but couldn't read it off the tag itself."* `handEntry` alone would
   * make a bare row for a car FG knows perfectly well — the tag being unreadable says nothing about
   * whether the car is on file.
   *
   * ⚠️ TYPED, THEREFORE NEVER CORRECTED — the same rule the airport flip states: the misread
   * corrector belongs under a camera, not under his thumbs.
   */
  const fromTyped = useMemo(() => {
    const raw = typed.trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return null;
    // ⭐⭐ PLATE FIRST, THEN THE UNIT — the same order `resolveKeytagScan` uses, and for the same
    // reason: FG should not fail to find a car it holds just because the weaker key is the one in
    // hand. He types *because* the plate is unreadable, so plate-only was the wrong single key.
    const digits = raw.replace(/\D/g, '');
    const v = vehicles.find(x => x.licensePlate.trim().toUpperCase() === raw)
      ?? (digits.length >= 5
        ? vehicles.find(x => (x.unitNumber ?? '').replace(/\D/g, '') === digits)
        : undefined);
    if (v) {
      const holds = getActiveHolds(v.id) as unknown as ActiveHold[];
      return { ...addScan(v, holds), excluded: exclusionReason(holds) };
    }
    // ⚠️ AND DO NOT FILE A UNIT NUMBER AS A PLATE. An all-digits string FG cannot place is a unit it
    // has never seen, not a licence — writing it into the Licence column would be a lie the sheet
    // then carries to the counter. Say so instead; the scan path is still open for it.
    if (digits.length === raw.length) return { unknownUnit: raw as string };
    return { ...addTag({ plate: raw }), excluded: null };
  }, [typed, vehicles, getActiveHolds, addScan, addTag]);

  const unknownUnit = fromTyped && 'unknownUnit' in fromTyped ? fromTyped.unknownUnit : null;
  const typedRow = fromTyped && 'unknownUnit' in fromTyped ? null : fromTyped;

  const pending = built ?? fromTag ?? typedRow;
  const pendingEntry: InventoryEntry | null = pending ? { ...pending.entry, ...edits } : null;


  function done() {
    setEdits({});
    setOverrode(false);
    setTyped('');
    reset();
  }

  async function onFile(file: File) {
    const base64 = await takeOne(file);
    if (!base64) return;
    const scanned = await scanPhoto(base64);
    // ⚠️ NON-BLOCKING BY THE HOOK'S OWN CONTRACT — a failed write never stops the write-up, exactly
    // as a failed write never stops a trip. The row is already built from the tag either way.
    if (scanned) await handleScanRead(scanned.read);
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
            Location 8073-16, PM. Supplements the paper — the tag fills four columns, you decide the status.
          </p>

          <ClosingInventoryStrip logged={counts.total} available={counts.byStatus.A}
            carriedStatus={carriedStatus} carriedRow={carriedRow} />

          <PhotoError message={photoError} />
          {unknownUnit && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              ⚠️ No car on file with unit <b>{unknownUnit}</b>. Scan its tag to put it on the sheet —
              a unit number can&apos;t go in the licence column.
            </p>
          )}
          {fromTag && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                ⚠️ <b>{fromTag.entry.plate}</b> wasn't on file. It still goes on the sheet —
                everything below came off the tag — and FG registers it from the read where it can.
              </p>
            </div>
          )}

          {editing ? (
            /* ⭐ THE SAME CARD, EDITING A RECORDED ROW — *"a new damage brought in after i've already
               recorded all the damages"*. One editor rather than a second one free to drift. */
            <ClosingInventoryCard entry={editing.entry} why="already on the sheet" suggestedRow={null}
              addLabel="Save" skipLabel="Cancel"
              onChange={patch => setEditing(x => (x ? { ...x, entry: { ...x.entry, ...patch } } : x))}
              onAdd={() => { updateAt(editing.index, editing.entry); setEditing(null); }}
              onSkip={() => setEditing(null)} />
          ) : pending && pendingEntry && pending.excluded && !overrodeExclusion ? (
            <ClosingInventoryExclusion plate={pendingEntry.plate} reason={pending.excluded}
              onSkip={done} onAnyway={() => setOverrode(true)} />
          ) : pending && pendingEntry ? (
            <ClosingInventoryCard entry={pendingEntry} why={pending.why} suggestedRow={pending.suggestedRow}
              onChange={patch => setEdits(e => ({ ...e, ...patch }))}
              onAdd={() => { commit(pendingEntry); done(); }}
              onSkip={done} />
          ) : (
            <>
              <ScanButton onFile={onFile} reading={reading} fullWidth
                label="Scan a key tag" className="py-3" />
              {/* ⚠️ Always present, never an error-state rescue — a fallback he has to fail first
                  to discover is one he waits on instead of using.
                  ⭐ And it matches the Movement Log now, on his call: a typeahead over plate OR unit
                  number, because the reason he is typing is usually that one of the two is
                  unreadable. Picking a suggestion skips the resolve entirely. */}
              <VehicleLookup busy={reading}
                onPick={c => setTyped('vehicle' in c ? c.vehicle.license_plate : c.typed)} />
            </>
          )}

          <ClosingInventorySheet entries={entries} tally={tally} onRemove={removeAt}
            onEdit={i => { const e = entries[i]; if (e) setEditing({ index: i, entry: e }); }}
            onUndo={undoLast} />

          {entries.length > 0 && (
            <>
              {/* ⭐⭐ THE WAY OUT, and the only one he asked for: *"how bout a simpler copy to paste
                  into an email? much like the airport flips for the counter."* Amber is FG's SHARE
                  lane, and this is the same gesture the flip's counter copy already uses. */}
              <div className="flex gap-2">
                <ShareTextButton
                  onClick={() => void share({
                    title: 'Closing inventory',
                    text: buildInventoryReport(entries, { location: LOT_NAME, dateLabel: shortDate() }),
                  })}
                  copied={copied}
                />
              </div>
              <button type="button" onClick={clear}
                className="text-[11px] text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition">
                Clear the sheet
              </button>
            </>
          )}
        </div>
      )}
      {registerToast && <Toast message={registerToast.message} variant={registerToast.tone}
        sparkle={registerToast.sparkle} />}
    </div>
  );
}
