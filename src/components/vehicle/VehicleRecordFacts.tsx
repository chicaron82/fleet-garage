import { useState } from 'react';
import { offersOnLotCheck, onLotLabel, onLotState } from '../../lib/onLotObservation';
import { vinFindings, vinFindingHint } from '../../lib/vinChecks';
import { identityGaps, describeIdentityGaps } from '../../lib/vehicleName';
import { lookupVehicleClass } from '../../../api/_lib/vehicleClassCodex';
import { useGeotabInstall } from '../../hooks/useGeotabInstall';
import { asRotation } from '../../lib/keytagPhotoRotation';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { KeytagZoomOverlay } from './KeytagZoomOverlay';
import { hapticLight } from '../../lib/haptics';
import { useVehicleSightings } from '../../hooks/useVehicleSightings';
import { describeLastSeen, isStaleSighting, sightingLines } from '../../lib/sightings';
import { useProfiles } from '../../context/ProfilesContext';
import type { KeytagAuditResult } from '../../types';
import { keyOptionsFor } from '../../lib/keyCount';
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

export function VehicleRecordFacts({ vehicleId, plate, keytagPhotoUrl, keytagPhotoRotation, keytagPhotoConfirmedAt, keytagPhotoConfirmedBy, keytagAudit, make, model, keyCount, isTesla, classCode, rentalClass, odometer, odometerAt, vinLast9, year, isUs, winterTires, winterTiresAt, onLot, onEditCodes }: {
  vehicleId: string;
  /** Drives the "last seen" lookup — sightings are keyed on plate, not id (see migrations/114). */
  plate?: string | null;
  keytagPhotoUrl?: string | null;
  /** Quarter-turns to apply when rendering it (migration 133). The file is never re-encoded. */
  keytagPhotoRotation?: number | null;
  keytagPhotoConfirmedAt?: string | null;
  keytagPhotoConfirmedBy?: string | null;
  /** ⚠️ The record did not carry these until 2026-09-07, which is quietly part of why a blank
   *  make/model was invisible HERE: the component could not have said what it did not receive. */
  make?: string | null;
  model?: string | null;
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
  /** Needed only to cross-check the VIN's model-year code against it. See vinChecks. */
  year?: number | null;
  /** US-plated: 🇺🇸 badge, and every odometer figure on this record reads MILES. */
  isUs?: boolean;
  winterTires?: boolean | null;
  winterTiresAt?: string | null;
  /** ⭐ Was this HELD car on the lot when he last looked (migration 142)? Grouped as ONE prop for the
   *  same reason `keytagAudit` is — the strip is already at thirteen, and these three only mean
   *  anything together. `vehicleStatus` is here because the control is offered to held cars only:
   *  an on-exception car is EXPECTED to be away, so its presence is not a question. */
  onLot?: { present?: boolean | null; checkedAt?: string | null; vehicleStatus?: string | null };
  /** Opens the identity modal. Omitted → the chip stays plain text, as it was before. */
  onEditCodes?: () => void;
}) {
  const { recordKeyCount, recordOdometer, clearOdometer, correctOdometer, recordWinterTires, recordOnLot } = useVehicleHoldContext();
  const sightings = useVehicleSightings(plate, vehicleId);
  const profiles = useProfiles();
  const [zoom, setZoom] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  // ⚠️ Uses the SAME predicate as Fleet's "Needs details" chip — see lib/vehicleName. Deriving it
  // here with a local rule is how two screens start disagreeing about the same car.
  const gaps = identityGaps({ year: year ?? null, make: make ?? null, model: model ?? null });
  /**
   * ⭐⭐ WHAT FG ALREADY KNOWS ABOUT THE GAP — Aaron, 2026-09-07: *"is CTMY not mapping to model y?"*
   * It maps perfectly. `lookupVehicleClass` simply runs at REGISTRATION, when a scan creates a
   * record, and nothing consults it afterwards — so a car that got its code later kept a blank model
   * while the answer sat in the codex. Offering it here is the knowledge arriving at the moment.
   *
   * ⚠️ Only when the codex actually answers the gap in front of him: a codex model is useless on a
   * car whose MODEL is already fine, and suggesting one for a missing YEAR would be inventing.
   */
  const codexSays = classCode ? lookupVehicleClass(classCode) : null;
  const codexFills = codexSays && (gaps.includes('model') || gaps.includes('make'))
    ? `${codexSays.make} ${codexSays.model}` : null;
  const geotab = useGeotabInstall(plate);
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
  //   stale      — legible, but it is a tag this car no longer wears (migration 134). Same list,
  //                different errand: a photo of a DIFFERENT tag, not a better one of the same.
  //   photo, unaudited — the old default: a model read it and nobody has checked.
  //   no photo   — the dashed first-capture state.
  const tagChip = !keytagPhotoUrl
    ? { label: '🏷️ No key tag', border: 'border-dashed border-gray-300 dark:border-gray-600', text: 'text-gray-400 dark:text-gray-500' }
    : keytagAudit?.result === 'unreadable'
    ? { label: '🏷️ Needs a retake', border: 'border-dashed border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400' }
    : keytagAudit?.result === 'stale'
    ? { label: '🏷️ Older plate', border: 'border-dashed border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400' }
    : keytagAudit?.result === 'verified'
    ? { label: '🏷️ Verified', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400' }
    : { label: '🏷️ As read', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-500 dark:text-gray-400' };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ⭐⭐ IS THE HELD CAR STILL ON THE LOT — recorded, never inferred. Aaron, 2026-09-12: *"if
          it's present on the lot tick the box. else unchecked its either been rented out between my
          shifts or sent to the bodyshop."*

          ⚠️⚠️ FG CANNOT DERIVE THIS. He is its only writer and writes when a car reaches him on
          shift, so an ACTIVE hold means "held when I last saw it", never "held continuously since".
          LUR527 is the proof: hail-flagged Sep 2, released for rent with NO release logged (the
          counter releases cars and does not use FG), 291 km driven, back on the 8th — the only trace
          was the odometer moving underneath an active hold.

          ⚠️ The copy never says "gone". Out on rent, at the bodyshop, and not-looked-at-yet are
          indistinguishable from here, so the chip reports the OBSERVATION and its date and stops. */}
      {offersOnLotCheck(onLot?.vehicleStatus) && (
        <button
          type="button"
          onClick={() => {
            hapticLight();
            void recordOnLot(vehicleId, { present: onLot?.present ?? null, checkedAt: onLot?.checkedAt ?? null });
          }}
          className={`rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition ${
            onLotState({ present: onLot?.present ?? null, checkedAt: onLot?.checkedAt ?? null }) === 'present'
              ? 'border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          📍 {onLotLabel({ present: onLot?.present ?? null, checkedAt: onLot?.checkedAt ?? null })}
        </button>
      )}
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
        title={keytagAudit?.at ? `${
          keytagAudit.result === 'unreadable' ? 'Flagged unreadable'
          : keytagAudit.result === 'stale' ? 'Flagged as an older tag'
          : 'Verified'} by ${keytagAudit.by ?? 'someone'} on ${new Date(keytagAudit.at).toLocaleDateString()}` : undefined}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer ${tagChip.border}`}
      >
        {keytagPhotoUrl && (
          /* A 32px SQUARE, so any quarter-turn fits with no sizing arithmetic — the transform is
             all this one needs. `overflow-hidden` on the box keeps a turn inside the chip. */
          <span className="block w-8 h-8 shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
            <img src={keytagPhotoUrl} alt="Key tag" className="w-full h-full object-cover"
              style={{ transform: `rotate(${asRotation(keytagPhotoRotation)}deg)` }} />
          </span>
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
          {/* ⭐ Emoji + value, nothing else (Aaron, 2026-09-12): *"how bout having the key emoji
              plus key count"*. The noun was doing no work — the emoji already says "keys" — and the
              ✏️ was a hint, which the row does not need when every chip on it is tappable. */}
          {isTesla ? '⚡' : '🔑'} {keyCount ?? '—'}
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
          /* He tapped to open this. Finishing that gesture is the point — he is at the dash with
             one hand free, and the second tap was never carrying information. */
          autoFocus
          onSave={async (id, km) => { await recordOdometer(id, km); setEditingOdo(false); }}
          /* Closes the editor on a successful clear, the same as a save — the row underneath then
             reads "Odometer not logged", which IS the confirmation. */
          onClear={async (id) => { const ok = await clearOdometer(id); if (ok) setEditingOdo(false); return ok; }}
          onCorrect={correctOdometer}
        />
      ) : (
        <button
          type="button"
          onClick={() => { hapticLight(); setEditingOdo(true); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer"
        >
          🛣️ {odometer ? describeOdometer(odometer, odometerAt, new Date(), odometerUnitFor(isUs)) : `Log odometer${isUs ? ' (mi)' : ''}`}
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

      {/* ☀️/❄️ — ONE chip, tapped to flip. Aaron, 2026-09-12: *"what about tapping it to make it
          switch between sun and snowflake. everything with sun, unless i've already switched it to
          have winters then those would have the snowflake."*

          ⚠️⚠️ THIS DELIBERATELY OVERTURNS AN EARLIER CALL, so the reasoning should not be lost. The
          chip used to render NOTHING when `winterTires` was null, on the principle that a car nobody
          had inspected must not be shown as "no winter tires" — a confident lie. His answer is an
          operational one and it is better: **summer IS the fleet's default state**, and winters are
          the exception somebody fits and marks. The residual cost is real and accepted — a car
          someone fitted winters to without telling FG reads ☀️ instead of staying silent.

          ⭐ The date rides along only on ❄️, where it is load-bearing: winters fitted in November
          are a fact that ages: by spring the tick is wrong and only the date can say so. A ☀️ needs
          no date because it is the resting state, not an observation. */}
      <button
        type="button"
        onClick={() => { hapticLight(); void recordWinterTires(vehicleId, !winterTires); }}
        className={`rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition ${
          winterTires
            ? 'border-sky-300 dark:border-sky-700/60 text-sky-800 dark:text-sky-300 hover:border-sky-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
        }`}
      >
        {winterTires ? '❄️' : '☀️'}
        {winterTires && winterTiresAt && (
          <span className="opacity-70"> · {describeOdometerAge(winterTiresAt)}</span>
        )}
      </button>

      {/* 🪪 REFERENCE, NOT WORK — Aaron, 2026-09-12, seeing the new chip land in a stack of eight:
          *"i'm not a fan of it being buried. along with the others."*

          ⚠️ The strip was never SORTED — it grew in the order each feature shipped, so the newest
          chip is simply last. The split that holds is not "important vs less": it is what he TAPS
          (state that changes — on the lot, odometer, keys, tires) versus what he LOOKS UP (identity
          that does not — VIN, class code, geotab install). Reference material is checked when
          something is wrong, never as part of a task, so it collapses. */}
      <button
        type="button"
        onClick={() => setShowIdentity(v => !v)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:border-gray-400 transition"
      >
        🪪 Identity {showIdentity ? '▴' : '▾'}
      </button>
      {showIdentity && (<>
      {/* ⭐⭐ THE GEOTAB INSTALL — Aaron, 2026-09-07: *"did it get cleared off the list? if so
          shouldn't it read somewhere that it was marked as installed on x date rather than hiding
          under 'no action needed' with no date attached?"*

          FG knew: `geotab_watchlist` held the date and the person since July. ⚠️ But its ONLY reader
          was `useGeotabPending`, which builds the list of cars still WAITING — so the instant a car
          is done it leaves that list and its install date becomes unreachable everywhere. The fact
          survived; its audience did not. */}
      {geotab && (
        <span
          title={geotab.installedAt
            ? `Marked installed ${new Date(geotab.installedAt).toLocaleString()}`
            : `Added to the geotab watchlist ${new Date(geotab.addedAt).toLocaleDateString()}`}
          className={`rounded-lg border px-2.5 py-1.5 text-xs ${geotab.installedAt
            ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
            : 'border-dashed border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400'}`}
        >
          📡 {geotab.installedAt
            ? `Geotab installed ${new Date(geotab.installedAt).toLocaleDateString()}${
                geotab.installedBy ? ` · ${profiles.get(geotab.installedBy)?.name ?? 'someone'}` : ''}`
            : 'Geotab pending'}
        </span>
      )}

      {/* ⭐⭐ WHAT THIS RECORD IS MISSING FROM ITS OWN NAME — Aaron, 2026-09-07: *"took me a sec to
          figure out what was still needed. at first i thought it was because no odo was recorded…
          but then realized make and model weren't showing."*

          `vehicleLabel` DROPS missing parts (correctly — so a null never renders as "null"), so a
          car with no make or model reads as `2024` and the gap is communicated by nothing being
          there. He had to notice a negative space and guess wrong once to find it.

          ⚠️ It names ONLY backfillable gaps, and deliberately not the odometer: *"i have a lot that
          don't have a reading"* — nagging a legitimate resting state manufactures work that never
          closes, which is the archived-cars defect this app was bitten by twice the same day.
          ⭐ The predicate is `identityGaps`, the same one Fleet's "Needs details" chip now uses, so
          the record and the count cannot drift apart. */}
      {gaps.length > 0 && (
        <button
          type="button"
          onClick={onEditCodes ? () => { hapticLight(); onEditCodes(); } : undefined}
          disabled={!onEditCodes}
          title={onEditCodes ? 'Fill in what this record is missing' : undefined}
          className="rounded-lg border border-dashed border-amber-400 dark:border-amber-700 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:cursor-default cursor-pointer transition"
        >
          🪪 Needs {describeIdentityGaps(gaps)}
          {/* ⭐ The answer, where the question is asked. Silent when the codex has nothing — an
              empty suggestion is worse than none on a field that decides a car's identity. */}
          {codexFills && <span className="ml-1 font-semibold">— FG knows: {codexFills}</span>}
        </button>
      )}

      {/* The last 9 of the VIN (migration 126). Stored on 380 cars and, until now, visible on
          none — a writer with no reader, the mirror of the odometer's reader with no writer.
          It earns a chip because it is the one identifier that survives a re-plate, and because
          a value you cannot SEE is one you can never notice is wrong. */}
      {vinLast9 && (() => {
        /* ⭐ THE VIN CHECKS ITSELF. Aaron worked the rule out from two tags — *"'T' was 2026 so
           pieced together that 'S' was 2025"* — and corrected two cars by hand before the
           verification query finished. Position 10 is the model-year code and lands as the SECOND
           character here; position 9 is the check digit and lands FIRST. Run over all 560 stored
           VINs the pair finds 10 misread year codes and one framing error, and they need different
           actions, so the chip says which. See lib/vinChecks.
           ⚠️ It NEVER proposes a value: on LJF698 the VIN was right and the YEAR was the misread. */
        const finding = vinFindings(vinLast9, year)[0] ?? null;
        return (
          <span
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-mono ${
              finding
                ? 'border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
            title={finding
              ? `${finding.detail}\n${vinFindingHint(finding)}`
              : 'Last 9 of the VIN, read off the key tag — not the full VIN'}
          >
            {finding ? '⚠️' : '🔖'} {vinLast9}
          </span>
        );
      })()}

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
      </>)}

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
          {/* Derived interactions carry a uuid; the profiles map is the only thing that can turn one
              into a person, which is why the resolver is passed in rather than looked up in the lib. */}
          {sightingLines(sightings.rows, id => profiles.get(id)?.name).map((l, i) => (
            <div key={`${l.day}-${l.time}-${i}`} className="flex items-baseline gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-mono tabular-nums">{l.day}</span>
              <span className="font-mono tabular-nums">{l.time}</span>
              <span className="shrink-0">{l.who}</span>
              {/* ⭐ WHAT IT WAS — Aaron, 2026-09-07: *"1 interaction. but doesn't show what the
                  interaction was."* The line carried when and who and never what, while the change
                  log one section below named the very fields that made the row exist. */}
              <span className="truncate text-gray-500 dark:text-gray-500">{l.what}</span>
            </div>
          ))}
        </div>
      )}

      {zoom && (
        <KeytagZoomOverlay
          vehicleId={vehicleId} plate={plate}
          keytagPhotoUrl={keytagPhotoUrl} keytagPhotoRotation={keytagPhotoRotation}
          keytagPhotoConfirmedAt={keytagPhotoConfirmedAt} keytagPhotoConfirmedBy={keytagPhotoConfirmedBy}
          audited={Boolean(keytagAudit?.at)} onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}
