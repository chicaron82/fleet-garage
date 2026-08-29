import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { KeytagRetake } from './KeytagRetake';
import { hapticLight } from '../../lib/haptics';
import { useVehicleSightings } from '../../hooks/useVehicleSightings';
import { describeLastSeen, isStaleSighting, sightingLines } from '../../lib/sightings';
import type { KeytagAuditResult } from '../../types';
import { keyOptionsFor, keyNoun } from '../../lib/keyCount';
import { describeOdometer, describeOdometerAge, odometerUnitFor } from '../../lib/odometer';
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

export function VehicleRecordFacts({ vehicleId, plate, keytagPhotoUrl, keytagAudit, keyCount, isTesla, classCode, rentalClass, odometer, odometerAt, vinLast9, isUs, winterTires, winterTiresAt, onEditCodes }: {
  vehicleId: string;
  /** Drives the "last seen" lookup — sightings are keyed on plate, not id (see migrations/114). */
  plate?: string | null;
  keytagPhotoUrl?: string | null;
  /** The human audit stamp (migration 130), grouped as ONE prop rather than three — this strip is
   *  already at thirteen and the trio only ever means something together. */
  keytagAudit?: { at?: string | null; by?: string | null; result?: KeytagAuditResult | null };
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
  /** US-plated: 🇺🇸 badge, and every odometer figure on this record reads MILES. */
  isUs?: boolean;
  winterTires?: boolean | null;
  winterTiresAt?: string | null;
  /** Opens the identity modal. Omitted → the chip stays plain text, as it was before. */
  onEditCodes?: () => void;
}) {
  const { recordKeyCount, recordOdometer, clearOdometer, recordWinterTires, reopenKeytagAudit } = useVehicleHoldContext();
  const sightings = useVehicleSightings(plate, vehicleId);
  const [zoom, setZoom] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);
  const [editingOdo, setEditingOdo] = useState(false);

  const setCount = (n: number) => {
    hapticLight();
    setEditingKeys(false);
    void recordKeyCount(vehicleId, n);
  };

  // ⭐ FOUR STATES IN ONE CHIP, because they are four answers to the same question — *what does FG
  // know about this car's tag?* A separate "audited" chip would have split that question across two
  // controls and spent a slot on the strip; the audit is a property OF the tag, not a fact beside it.
  //   verified   — a person read the photo against the record; its fields are now locked 'manual'.
  //   unreadable — the photo defeated him (migration 130). THIS is the retake watchlist surfacing.
  //   photo, unaudited — the old default: a model read it and nobody has checked.
  //   no photo   — the dashed first-capture state.
  const tagChip = !keytagPhotoUrl
    ? { label: '🏷️ No key tag on file — tap to add', border: 'border-dashed border-gray-300 dark:border-gray-600', text: 'text-gray-400 dark:text-gray-500' }
    : keytagAudit?.result === 'unreadable'
    ? { label: '🏷️ Key tag needs a retake — tap to replace', border: 'border-dashed border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400' }
    : keytagAudit?.result === 'verified'
    ? { label: '🏷️ Key tag verified — tap to view', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400' }
    : { label: '🏷️ Key tag as read — tap to check', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400' };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ⚠️ THE CHIP RENDERS EITHER WAY. It used to be gated on the URL, so a car with no tag on
          file showed NOTHING — and "there is no tag" looked exactly like "there is a chip and I
          didn't look at it". Aaron, 2026-08-28: *"to reduce my API calls I type it in. problem: it
          doesn't tell me if it's missing a keytag."* Same shape as a blank inspection slip: an
          absence that reads as fine. 137 cars are in this state and none of them could say so.
          Dashed + "tap to add", matching the winter-tires empty state, and it opens the same modal
          so the capture is one tap from the discovery. */}
      <button
        type="button"
        onClick={() => setZoom(true)}
        title={keytagAudit?.at ? `${keytagAudit.result === 'unreadable' ? 'Flagged unreadable' : 'Verified'} by ${keytagAudit.by ?? 'someone'} on ${new Date(keytagAudit.at).toLocaleDateString()}` : undefined}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer ${tagChip.border}`}
      >
        {keytagPhotoUrl && (
          <img src={keytagPhotoUrl} alt="Key tag" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
        )}
        <span className={`text-xs ${tagChip.text}`}>{tagChip.label}</span>
      </button>

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
          isUs={isUs}
          vehicleId={vehicleId}
          /* The card shows ONE car, so switching cars is the only reset worth having — no event
             here to key on, unlike the scan. See OdometerCapture's `resetKey`. */
          resetKey={vehicleId}
          currentKm={odometer}
          currentAt={odometerAt}
          onSave={async (id, km) => { await recordOdometer(id, km); setEditingOdo(false); }}
          /* Closes the editor on a successful clear, the same as a save — the row underneath then
             reads "Odometer not logged", which IS the confirmation. */
          onClear={async (id) => { const ok = await clearOdometer(id); if (ok) setEditingOdo(false); return ok; }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { hapticLight(); setEditingOdo(true); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer"
        >
          🛣️ {odometer ? `${describeOdometer(odometer, odometerAt, new Date(), odometerUnitFor(isUs))} · tap to update` : `Log odometer${isUs ? ' (mi)' : ''}`}
        </button>
      )}

      {/* 🇺🇸 A US-plated car, plain and small — Aaron declined anything louder. It is doing more work
          than it looks: it is also why the odometer above says "mi", and he reads it as "cannot be
          rented here, goes back to Fargo". The flag is enough because HE knows what it means; the
          record does not need to lecture him about his own fleet. */}
      {isUs && (
        <span className="rounded-lg border border-blue-300 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
          🇺🇸 US plates · miles
        </span>
      )}

      {/* ❄️ Winter tires as last OBSERVED. ⚠️ Rendered only when someone has actually looked —
          `null` means never checked, which is NOT "no", and a chip saying "no" for a car nobody has
          inspected would be a confident lie. The date is the half that stops it aging: a tick from
          February is wrong by the following winter, and only the date can say so. */}
      {/* ⚠️ TAPPABLE, because the field is SEASONAL and shipped this morning with the registration form
          as its only writer — a value designed to change twice a year, settable exactly once, at
          birth. Tapping flips it and re-stamps the date, so the answer is always "what he last saw",
          never "what someone said in August".

          Shown only once someone has looked: `null` means nobody has, which is NOT "no", and a chip
          asserting "no winter tires" for an uninspected car would be a confident lie. He starts it
          from the register form or from an explicit tap here. */}
      {winterTires != null && (
        <button
          type="button"
          onClick={() => { hapticLight(); void recordWinterTires(vehicleId, !winterTires); }}
          className={`rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition ${
            winterTires
              ? 'border-sky-300 dark:border-sky-700/60 text-sky-800 dark:text-sky-300 hover:border-sky-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          ❄️ {winterTires ? 'Winter tires' : 'No winter tires'}
          {winterTiresAt && <span className="opacity-70"> · {describeOdometerAge(winterTiresAt)}</span>}
        </button>
      )}
      {/* The first observation for a car nobody has checked — quiet, and only on a US car or in the
          months it matters would be over-engineering, so it simply sits with the other chips. */}
      {winterTires == null && (
        <button
          type="button"
          onClick={() => { hapticLight(); void recordWinterTires(vehicleId, true); }}
          className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer transition"
        >
          ❄️ Winter tires?
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

      {/* Last seen — two kinds of evidence, one chip: a KEY-TAG SCAN (he held the tag), and an
          INTERACTION derived from `vehicle_changes` (he wrote something to this car). Read-only.

          ⚠️ THE NOUN IS "INTERACTIONS", NOT "SCANS", and it is load-bearing. His key count and his
          odometer landed six seconds apart on LUR224 — one visit, two interactions. Counting
          interactions makes the number LITERALLY TRUE with no merging, so no time window has to
          exist (see lib/sightings.sightingsFromChanges). Aaron's own word, from the report that
          started this: *"scanned 2x or however many interactions were done."* */}
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
        title={sightings.lastSeenAt ? `Last here ${new Date(sightings.lastSeenAt).toLocaleString('en-CA')}` : 'Nothing on record for this car yet'}
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
          /* Not "never scanned" — the chip no longer only counts scans, and a car FG has genuinely
             never touched is a different claim from one he simply hasn't photographed. */
          ? 'Never here'
          : sightings.priorSeenAt === null
            /* Scanned for the first time ever — there is no "before this", and inventing one by
               falling back to lastSeenAt would just print "today" again. */
            ? 'First time on record · here now'
            /* NOT "last ${…}" — describeLastSeen returns a COMPLETE phrase, so the prefix produced
               "last last week", "last 3 days ago", "last yesterday". Found by rendering the card at
               phone width during /reflect 63; no test could see it, because every test asserted on
               the function's output rather than the sentence it lands in. */
            : `Last here ${describeLastSeen(sightings.priorSeenAt)} · ${sightings.count} interaction${sightings.count === 1 ? '' : 's'}`}
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

      {zoom && (
        /* flex-col: the retake controls sit UNDER the tag, not beside it. The backdrop is absolute
           so it stays out of the flow. Opens with NO photo too — that is the whole point of the
           dashed chip above; `KeytagRetake` is a first capture as readily as a replacement. */
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" onClick={() => setZoom(false)}>
          <div className="absolute inset-0 bg-black/80" />
          {keytagPhotoUrl ? (
            <img src={keytagPhotoUrl} alt="Key tag" className="relative max-h-[75dvh] max-w-full rounded-lg object-contain" />
          ) : (
            <p className="relative text-white/70 text-sm">No key tag photo on file for this car.</p>
          )}
          {/* ⭐ The fix belongs where the problem is DISCOVERED. He opens this to check a tag; if it
              is unreadable, the retake is right here rather than on another screen. stopPropagation
              because the backdrop closes on click and a file picker must not dismiss its own modal. */}
          <div className="relative mt-3 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
            <KeytagRetake vehicleId={vehicleId} onReplaced={() => setZoom(false)} />
            {/* ⭐⭐ THE AUDITOR'S UNDO, and it belongs here rather than in the auditor — an audited
                car has already LEFT the queue, so the auditor has no screen on which to offer it.
                Without this the first wrong entry (FVB4297, a rental class typed into the model-code
                box because that tag's own heading reads `Class`) could only be undone with
                hand-written SQL. A surface that writes at the top of the provenance ladder needs a
                way back, or every one of its mistakes is permanent. */}
            {keytagAudit?.at && (
              <button
                type="button"
                onClick={() => { void reopenKeytagAudit(vehicleId); setZoom(false); }}
                className="text-xs font-semibold text-white/70 hover:text-white underline cursor-pointer"
              >
                Re-audit this tag — put it back in the queue
              </button>
            )}
          </div>
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
