import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight } from '../../lib/haptics';
import { useVehicleSightings } from '../../hooks/useVehicleSightings';
import { describeLastSeen, isStaleSighting, sightingLines } from '../../lib/sightings';
import { keyOptionsFor, keyNoun } from '../../lib/keyCount';
import { describeOdometer } from '../../lib/odometer';
import { OdometerCapture } from '../shared/OdometerCapture';

// What the record knows about this car's physical handover: the key tag it was READ from, and how
// many keys are on the ring. Both live here (rather than inline in VehicleHistory, which sits at
// the line cap) so the vehicle card has somewhere to grow as more of these facts land.
//
// The tag: Aaron's ask (2026-07-21) — "if it was entered/read wrong can open it up to see what was
// on the tag and correct the details." A vision read can mis-see a plate or unit; without the tag
// there's no way to check a suspect record short of finding the physical car. Tap to enlarge, then
// use the ✏️ identity edit beside it to fix.
//
// The keys: the EXPECTED count the check-in diffs against — and EDITABLE here, because it was
// see-only and a flip count overwrites it. Without a correction path, one miscount at a return
// silently becomes the car's new truth and there's no way back (and no way to rehearse a shortfall
// without permanently lowering a baseline). Same principle as the tag: see it, and be able to fix it.
// Options come from the car, not from a constant: a Tesla carries exactly one keycard, so the
// other three were never answerable. See lib/keyCount.

// The codes: both of the tag's vocabularies for "what kind of car is this" — the 4-char MODEL code
// off the tag's corner (CRHX) and the rental CLASS the branch groups it under (Q4). Aaron asked for
// the model code here (2026-08-20) because it was only ever visible while REGISTERING: the moment
// the car was on record, the code that identified it disappeared from view. The rental class had
// the identical defect — stored, editable in the ✏️ modal, invisible on the card — so it comes too
// rather than leaving an arbitrary half.
//
// ⭐ TAPPABLE since 2026-08-25, and the original objection survives intact. This header used to say
// "display-only… a second edit path for one field is how two surfaces start disagreeing" — a good
// rule, and it still holds, because `onEdit` opens THE SAME identity modal. A second DOOR to one
// path is not a second path. Aaron: *"to be able to edit the class and/or code right there (if
// needed) by tapping the 'CRHX - Q4'."* He is standing at the car; the chip is where he noticed the
// wrong value, so it is where the fix belongs.
//
// Silent when absent — 155 of the fleet legitimately have no code, and a "set me" prompt on every
// one of them is noise, not a nudge. Read-only without `onEdit`, so surfaces that shouldn't edit
// simply don't pass it.

export function VehicleRecordFacts({ vehicleId, plate, keytagPhotoUrl, keyCount, isTesla, classCode, rentalClass, odometer, odometerAt, vinLast9, onEditCodes }: {
  vehicleId: string;
  /** Drives the "last seen" lookup — sightings are keyed on plate, not id (see migrations/114). */
  plate?: string | null;
  keytagPhotoUrl?: string | null;
  keyCount?: number | null;
  /** Drives what the key picker may offer — a Tesla has one card and no alternatives. */
  isTesla?: boolean;
  /** Last odometer reading + when (migration 123). Rendered together, never the number alone. */
  odometer?: number | null;
  odometerAt?: string | null;
  /** The tag's 4-char model code (CRHX). Null for the ~155 cars whose tag never gave one. */
  classCode?: string | null;
  /** The branch's rental grouping (Q4, B4, C…) — a different axis from the model code. */
  rentalClass?: string | null;
  /** Last 9 of the VIN (migration 126). Never the full VIN — nothing may decode a make from it. */
  vinLast9?: string | null;
  /** Opens the identity modal. Omitted → the chip stays plain text, as it was before. */
  onEditCodes?: () => void;
}) {
  const { recordKeyCount, recordOdometer } = useVehicleHoldContext();
  const sightings = useVehicleSightings(plate);
  const [zoom, setZoom] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);
  const [editingOdo, setEditingOdo] = useState(false);

  const setCount = (n: number) => {
    hapticLight();
    setEditingKeys(false);
    void recordKeyCount(vehicleId, n);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {keytagPhotoUrl && (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <img src={keytagPhotoUrl} alt="Key tag" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
          <span className="text-xs text-gray-500 dark:text-gray-400">🏷️ Key tag as read — tap to check</span>
        </button>
      )}

      {editingKeys ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{isTesla ? '⚡' : '🔑'}</span>
          {keyOptionsFor(isTesla === true).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold border transition cursor-pointer ${keyCount === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              {n}
            </button>
          ))}
          <button type="button" onClick={() => setEditingKeys(false)} className="ml-0.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { hapticLight(); setEditingKeys(true); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          {isTesla ? '⚡' : '🔑'} {keyCount
            ? `${keyCount} ${keyNoun(isTesla === true, keyCount)}`
            : isTesla ? 'Keycard — set' : 'Keys — set'} ✏️
        </button>
      )}

      {/* The odometer, always with its age — the airport's "high km?" question is about a number
          whose meaning decays. A bare figure from April would invite a decision on a stale fact. */}
      {/* ⭐ TAP TO SET — the same interaction the key-count chip beside it already uses, rather
          than a third shape for the same idea. Aaron, 2026-08-25: *"I think the odometer capture
          should exist on the vehicle record too not just on the initial header scan."*
          It shipped able to be written from ONE surface (the airport flip), which is how it stood
          at 0 of 683 while this very chip rendered a slot for it. The record card is where he
          looks when he is NOT mid-scan.
          Rendered even when BLANK now: an invisible affordance can't be the answer to "there's no
          way to enter this", and a car with no reading is exactly the one worth offering. */}
      {editingOdo ? (
        <OdometerCapture
          vehicleId={vehicleId}
          /* The card shows ONE car, so switching cars is the only reset worth having — no event
             here to key on, unlike the scan. See OdometerCapture's `resetKey`. */
          resetKey={vehicleId}
          currentKm={odometer}
          currentAt={odometerAt}
          onSave={async (id, km) => { await recordOdometer(id, km); setEditingOdo(false); }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { hapticLight(); setEditingOdo(true); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer"
        >
          🛣️ {odometer ? `${describeOdometer(odometer, odometerAt)} · tap to update` : 'Log odometer'}
        </button>
      )}

      {/* The last 9 of the VIN (migration 126). Stored on 380 cars and, until now, visible on
          none — a writer with no reader, the mirror of the odometer's reader with no writer.
          It earns a chip because it is the one identifier that survives a re-plate, and because
          a value you cannot SEE is one you can never notice is wrong. */}
      {vinLast9 && (
        <span
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono"
          title="Last 9 of the VIN, read off the key tag — not the full VIN"
        >
          🔖 {vinLast9}
        </span>
      )}

      {(classCode || rentalClass) && (() => {
        const label = `🚘 ${[classCode, rentalClass].filter(Boolean).join(' · ')}`;
        const title = [
          classCode ? `Model code ${classCode} — what the tag's corner reads` : null,
          rentalClass ? `Rental class ${rentalClass} — how the branch groups it` : null,
          onEditCodes ? 'Tap to correct either — a correction also pins the code→class mapping' : null,
        ].filter(Boolean).join('\n');
        const base = 'rounded-lg border px-2.5 py-1.5 text-xs font-mono';
        return onEditCodes ? (
          <button
            type="button"
            onClick={onEditCodes}
            title={title}
            data-testid="vehicle-codes-chip"
            /* Same 44px-class target as the other tappable chips on this row — gloves on. */
            className={`${base} border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-200 transition`}
          >
            {label}
          </button>
        ) : (
          <span className={`${base} border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400`}
                title={title} data-testid="vehicle-codes-chip">
            {label}
          </span>
        );
      })()}

      {/* Last seen — a SCAN is the only event in FG that means "he was standing at this car with
          the tag in his hand". Read-only: it's a record of what happened, not a field to set.
          Going-forward only (nothing logged scans before 2026-08-16), so "never scanned" is the
          honest day-one state for most of the fleet and reads as *not yet*, not as broken. */}
      <button
        type="button"
        onClick={() => setSeenOpen(o => !o)}
        disabled={sightings.neverSeen}
        data-testid="seen-chip"
        /* ⭐ TAP REVEALS THE WHOLE HISTORY (Aaron, 2026-08-26: "tapping the last seen reveals its
           full history") — and it is a better answer than the one I was reaching for. The chip had
           been trying to pick THE one right date, and every candidate was defensible and none was
           complete: the newest is his own scan, the prior one assumes he scanned at all, a bare
           count says nothing. Showing them all on demand dissolves the argument instead of settling
           it. Disabled when there is nothing to reveal, so a dead tap never happens. */
        className={`rounded-lg border px-2.5 py-1.5 text-xs text-left ${
          sightings.neverSeen ? '' : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500'
        } ${
          isStaleSighting(sightings)
            ? 'border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}
        /* The exact newest scan stays in the tooltip — including this visit's. The chip answers
           "when did I have it before now"; the tooltip keeps the raw fact available. */
        title={sightings.lastSeenAt ? `Last scanned ${new Date(sightings.lastSeenAt).toLocaleString('en-CA')}` : 'No key-tag scan on record yet'}
      >
        {/* ⚠️ A BARE COUNT BESIDE A BARE DATE RECOMPOSES INTO ONE FALSE FACT, whatever the values.
            This read `Seen ${count}× · ${describeLastSeen(lastSeenAt)}` — an ALL-TIME count welded
            to the LATEST date by a middot. On LUR330 (one scan yesterday 13:18, one today 07:21)
            that rendered "Seen 2× · today", which claims both happened today. Aaron, 2026-08-26:
            *"how this reads is kinda deceiving… fairly confident I cleaned it yesterday."* He had.
            ⚠️ And it worsens with age — the number climbs while the date stays "today" on every
            scan, drifting toward "Seen 47× · today".

            So the two halves are separate CLAIMS now: a complete sentence, then a total.

            ⭐ And the date is `priorSeenAt`, not `lastSeenAt` — his own scan is what opened this
            record, so "last seen" was reporting his act of looking back to him as news. The
            question worth answering while standing at the car is the one BEFORE this. */}
        👁️ {sightings.neverSeen
          ? 'Never scanned'
          : sightings.priorSeenAt === null
            /* Scanned for the first time ever — there is no "before this", and inventing one by
               falling back to lastSeenAt would just print "today" again. */
            ? 'First scan · here now'
            /* NOT "last ${…}" — describeLastSeen returns a COMPLETE phrase, so the prefix produced
               "last last week", "last 3 days ago", "last yesterday". Found by rendering the card at
               phone width during /reflect 63; no test could see it, because every test asserted on
               the function's output rather than the sentence it lands in. */
            : `Last here ${describeLastSeen(sightings.priorSeenAt)} · ${sightings.count} scans`}
        {!sightings.neverSeen && <span className="ml-1 opacity-50">{seenOpen ? '▴' : '▾'}</span>}
      </button>

      {/* Every visit, newest first. `basis-full` so it drops to its own row inside the chip wrap
          rather than squeezing between two chips. */}
      {seenOpen && !sightings.neverSeen && (
        <div className="basis-full rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-2"
             data-testid="seen-history">
          {sightingLines(sightings.rows).map((l, i) => (
            <div key={`${l.day}-${l.time}-${i}`} className="flex items-baseline gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-mono tabular-nums">{l.day}</span>
              <span className="font-mono tabular-nums">{l.time}</span>
              <span className="truncate">{l.who}</span>
            </div>
          ))}
        </div>
      )}

      {zoom && keytagPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setZoom(false)}>
          <div className="absolute inset-0 bg-black/80" />
          <img src={keytagPhotoUrl} alt="Key tag" className="relative max-h-[85dvh] max-w-full rounded-lg object-contain" />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setZoom(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
