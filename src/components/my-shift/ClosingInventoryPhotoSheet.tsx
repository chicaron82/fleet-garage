// The finished write-up, rendered to be PHOTOGRAPHED — step 4 of the closing checklist,
// *"send inventory photo to counter."*
//
// ⭐⭐ WHY A SCREEN AND NOT A FILE. The delivery has always been a photo: he writes form 8073-16 by
// hand and sends a picture of it. A downloaded HTML file adds two steps (find it, open it) to a job
// done one-handed at 23:00, and lands him in a browser instead of his camera. So the export IS the
// screen — laid out like the paper, and pointed at with the phone he is already holding.
//
// ⚠️ IT IS DELIBERATELY LIGHT IN BOTH THEMES. Every other surface in FG follows the device; this one
// must not, because the artifact is a white form and a photograph of a dark-mode table does not read
// as one to whoever opens it at the counter. The colours here are fixed on purpose — this is the
// single-visual-world exception, not a missing set of `dark:` variants.
//
// ⭐ Pure and prop-driven, so it renders in a test with no scanner, no camera and no session.
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  formatUnitNumber, rowLabel, sheetNote, STATUS_LABELS,
  type InventoryEntry, type InventoryStatus, type RowTally,
} from '../../lib/closingInventory';

export interface PhotoSheetMeta {
  /** Which branch's lot this sheet covers. */
  branch: string;
  /** Already formatted for reading — the component does not own a clock. */
  dateLabel: string;
  timeLabel: string;
  loggedBy: string;
}

/** The form's legend, in the order it is printed. */
const LEGEND: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

export function ClosingInventoryPhotoSheet({ entries, tally, meta, onClose }: {
  entries: readonly InventoryEntry[];
  tally: readonly RowTally[];
  meta: PhotoSheetMeta;
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const byStatus = LEGEND.map(s => ({ s, n: entries.filter(e => e.status === s).length }))
    .filter(x => x.n > 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/80 p-3 sm:p-6">
      {/* ⭐ The close control sits OUTSIDE the sheet's border, so what he frames in the photo is
          just the form. Chrome inside the card would end up in the picture sent to the counter. */}
      <div className="mx-auto flex max-w-3xl items-center justify-between pb-2">
        <p className="text-[11px] font-medium text-gray-300">Point the camera at the sheet.</p>
        <button type="button" onClick={onClose} aria-label="Close the sheet"
          className="cursor-pointer rounded-md px-2 py-1 text-lg leading-none text-gray-300 transition hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </div>

      <div className="mx-auto max-w-3xl rounded-lg border border-gray-300 bg-white p-4 text-gray-900 shadow-2xl sm:p-6">
        <header className="border-b-2 border-gray-900 pb-2">
          <h2 className="text-base font-bold leading-tight sm:text-lg">Location Daily Vehicle Inventory</h2>
          <p className="mt-0.5 text-[11px] text-gray-600 sm:text-xs">
            Form 8073-16 · PM · {meta.branch} · {meta.dateLabel} {meta.timeLabel} · {meta.loggedBy}
          </p>
        </header>

        {/* ⚠️ Mileage, AM Check and Arrived Overnight are absent on purpose — they belong to the
            morning pass and are blank on both of his real PM sheets. Dead columns would be theatre. */}
        <div className="overflow-x-auto">
          <table className="mt-3 w-full border-collapse text-[12px] tabular-nums sm:text-[13px]">
            <thead>
              <tr className="border-b border-gray-400 text-left text-[10px] uppercase tracking-wide text-gray-600 sm:text-[11px]">
                <th className="w-7 py-1 pr-1 font-semibold">#</th>
                <th className="py-1 pr-2 font-semibold">Own</th>
                <th className="py-1 pr-2 font-semibold">Unit&nbsp;#</th>
                <th className="py-1 pr-2 font-semibold">License</th>
                <th className="py-1 pr-2 font-semibold">Cls</th>
                <th className="w-8 py-1 pr-2 text-center font-semibold">St</th>
                <th className="w-full py-1 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.plate}-${i}`} className="border-b border-gray-200 last:border-0">
                  <td className="py-1 pr-1 text-gray-400">{i + 1}</td>
                  <td className="py-1 pr-2 text-gray-700">{e.owningArea ?? ''}</td>
                  <td className="py-1 pr-2 text-gray-700">{formatUnitNumber(e.unitNumber)}</td>
                  <td className="py-1 pr-2 font-semibold">{e.plate}</td>
                  <td className="py-1 pr-2 text-gray-700">{e.rentalClass ?? ''}</td>
                  <td className="py-1 pr-2 text-center text-[15px] font-bold">{e.status}</td>
                  <td className="py-1 text-gray-800">{sheetNote(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="mt-3 border-t border-gray-300 pt-2 text-[11px] text-gray-700">
          <p className="font-semibold">
            {entries.length} {entries.length === 1 ? 'vehicle' : 'vehicles'}
            {byStatus.length > 0 && (
              <span className="font-normal text-gray-600">
                {' — '}{byStatus.map(x => `${x.n} ${STATUS_LABELS[x.s].toLowerCase()}`).join(' · ')}
              </span>
            )}
          </p>

          {/* ⚠️ Where the available cars ARE — never the carried row. Aaron caught that conflation
              on his phone: *"I have available cars in 3 different rows but only shows the last row
              I used."* */}
          {tally.length > 0 && (
            <p className="mt-0.5 text-gray-600">
              Available by row: {tally.map(t => `${t.label} ${t.count}${t.capacity ? `/${t.capacity}` : ''}`).join(' · ')}
            </p>
          )}

          <p className="mt-1 text-[10px] text-gray-500">
            {LEGEND.map(s => `${s} ${STATUS_LABELS[s].toLowerCase()}`).join(' · ')}
            {' · '}row shown as {rowLabel('5')} for available cars only
          </p>
          {/* ⚠️ Said out loud on the sheet itself, because the photo travels without me. Sale,
              turnback and buy-back cars are not written up, and FG can only recognise the first. */}
          <p className="mt-0.5 text-[10px] text-gray-500">
            Supplements the paper form. Sale / turnback / buy-back cars are not written up.
          </p>
        </footer>
      </div>
    </div>
  );
}
