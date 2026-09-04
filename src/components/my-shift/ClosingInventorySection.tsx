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
import { useKeytagScan } from '../../hooks/useKeytagScan';
import { usePhotoIntake } from '../../hooks/usePhotoIntake';
import { useClosingInventory } from '../../hooks/useClosingInventory';
import { useShareText } from '../../hooks/useShareText';
import { PhotoError } from '../shared/PhotoError';
import { ScanButton } from '../shared/ScanButton';
import { ShareTextButton } from '../shared/ShareTextButton';
import { buildInventoryReport } from '../../lib/closingInventoryReport';
import { ClosingInventoryCard, ClosingInventoryExclusion } from './ClosingInventoryCard';
import { ClosingInventorySheet } from './ClosingInventorySheet';
import { ClosingInventoryPhotoSheet } from './ClosingInventoryPhotoSheet';
import { businessDateOf } from '../../lib/shiftDay';
import { formatDateStr } from '../../lib/buildShiftReport';
import { exclusionReason, type ActiveHold, type InventoryEntry } from '../../lib/closingInventory';

/**
 * The lot this write-up covers. FG is branch-scoped (YWG), but the closing inventory is specifically
 * the ERIN ST washbay lot — and the counter thinks in places, not branch codes.
 */
const LOT_NAME = 'Erin St';

/**
 * The location code pre-printed on the form itself — his sheet reads "Location: 8073-16".
 * ⚠️ NOT a form number, however much it looks like one. See PhotoSheetMeta.locationCode.
 */
const LOCATION_CODE = '8073-16';

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
  /** The photo-ready sheet — step 4 of the closing checklist, "send inventory photo to counter". */
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const { user, activeBranch } = useAuth();
  const { copied, share } = useShareText();
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

  async function onFile(file: File) {
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
            Location 8073-16, PM. Supplements the paper — the tag fills four columns, you decide the status.
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
              <ScanButton onFile={onFile} reading={reading} fullWidth
                label="Scan a key tag" className="py-3" />
            </>
          )}

          <ClosingInventorySheet entries={entries} tally={tally} onRemove={removeAt} />

          {entries.length > 0 && (
            <>
              {/* ⭐⭐ TWO WAYS OUT, because the counter takes either one. The PLAIN TEXT block is the
                  one Aaron asked for by pointing at something that already works — *"much like the
                  airport flips for the counter"* — and it pastes straight into an email. The full
                  sheet is the form itself, for when a picture is what is wanted.
                  ⭐ Amber is FG's SHARE lane; yellow is a primary action on the page. Two lanes, not
                  two primaries. */}
              <div className="flex gap-2">
                <ShareTextButton
                  onClick={() => void share({
                    title: 'Closing inventory',
                    text: buildInventoryReport(entries, { location: LOT_NAME, dateLabel: shortDate() }),
                  })}
                  copied={copied}
                />
                <button type="button" onClick={() => setShowPhotoSheet(true)}
                  className="flex-1 rounded-xl bg-fg-yellow py-3 text-sm font-semibold text-gray-900 transition hover:bg-fg-yellow-hi cursor-pointer">
                  📋 Full sheet
                </button>
              </div>
              <button type="button" onClick={clear}
                className="text-[11px] text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition">
                Clear the sheet
              </button>
            </>
          )}
        </div>
      )}

      {showPhotoSheet && (
        <ClosingInventoryPhotoSheet
          entries={entries}
          tally={tally}
          meta={{
            locationCode: LOCATION_CODE,
            branch: activeBranch,
            // ⚠️ The BUSINESS date, not the calendar one — a write-up finished after midnight still
            // belongs to the shift that did it, which is the whole reason shiftDay exists.
            dateLabel: formatDateStr(businessDateOf(new Date())),
            timeLabel: new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false }),
            loggedBy: user?.name ?? '',
          }}
          onClose={() => setShowPhotoSheet(false)}
        />
      )}
    </div>
  );
}
