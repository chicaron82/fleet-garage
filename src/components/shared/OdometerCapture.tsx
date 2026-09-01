import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { parseOdometer, describeOdometer, odometerUnitFor, checkOdometerJump, classifyOdometerEntry } from '../../lib/odometer';
import { useRoutedProp } from '../../hooks/useRoutedProp';

// The odometer, captured where he's already standing (2026-08-25).
//
// Migration 123 added the column and gave it exactly ONE writer: the airport flip. So a number he
// reads off a dash a dozen times a shift could only reach FG through a surface he uses at the
// airport — and the flip's own sync hadn't fired since Aug 5, which is why the column stood at
// **0 of 683 cars** while `VehicleRecordFacts` faithfully rendered a slot for it on every record.
// A capability reachable from one surface that doesn't fire is, in practice, absent.
//
// Aaron, holding a 2022 Tesla's screen reading 110,451 km: *"let's do the odometer."* The scan is
// the right home — he is at the dash with the tag in his hand, and FG is already recording the
// sighting, the owning area, the class code, the key count and now the VIN in that same beat.
//
// ⚠️ Renders the LAST READING WITH ITS DATE, never a naked number (migration 123's rule). A bare
// "47,200 km" ages into a lie; a figure from April describes a car that has since done a summer of
// rentals. And a lower reading than the one on file is a misread or the wrong car — `recordOdometer`
// refuses it server-side rather than rewriting a good record, so this says so BEFORE he taps.
export function OdometerCapture({ vehicleId, resetKey, currentKm, currentAt, isUs, onSave, onClear, onCorrect }: {
  vehicleId: string;
  /** What counts as "a new subject", decided by the CALLER — because the two homes mean different
   *  things by it. The SCAN passes its per-scan nonce, because a scan is an EVENT and re-scanning
   *  the same car must still clear the box. The RECORD CARD passes the vehicle id, because there is
   *  no repeat event there — the card simply shows one car, and switching cars is the only reset
   *  worth having. Same control, two honest reset semantics, no second copy. */
  resetKey: string | number;
  currentKm?: number | null;
  currentAt?: string | null;
  /** ⚠️ THE CAPTURE CONTROL HAD TO LEARN THIS TOO, and it did not on the first pass. When FG met its
   *  first US car (2026-08-27) I taught the record's odometer CHIP to say "mi" and left this — the
   *  control he actually TYPES INTO, on the scan sheet — hard-coded to "km on the dash". So the Jeep's
   *  record read 23,175 mi while the box under it asked him for kilometres. Fixed the reader I was
   *  looking at and not the one beside it, which is the same defect I spent the week writing up. */
  isUs?: boolean;
  onSave: (vehicleId: string, km: number) => Promise<void>;
  /** Clears a mis-typed reading back to "not logged". Omitted → no clear offered (read-only hosts). */
  onClear?: (vehicleId: string) => Promise<boolean>;
  /** ⭐ Replaces a WRONG value on file with a lower, correct one. Omitted → no correction offered.
   *  Deliberately separate from `onSave`: the forward-only rule owns the ordinary path and stays
   *  intact, so going down has to be a different call as well as a different tap. */
  onCorrect?: (vehicleId: string, km: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const unit = odometerUnitFor(isUs);

  useRoutedProp(resetKey, () => { setDraft(''); setSaved(false); });

  const km = parseOdometer(draft);
  // ⚠️ `<=`, MATCHING THE WRITE — it was `<`, which quietly disagreed with it. The write's rule is
  // `incoming > stored` (lib/odometer.shouldReplaceOdometer), so an EQUAL reading is refused there.
  // With a strict `<` here the button was ENABLED for an equal value: tapping Log returned early
  // without writing, and this component still flipped to "✓ 8,810 km saved". A success message for
  // a write that never happened — the same lie R61/R62 named, one surface over. Found 2026-08-26 by
  // a test whose expectation matched the WRITE rather than the button.
  //
  // Renamed with it: the old name described a DIRECTION; what the button needs to know is "this
  // will not be accepted", which is a wider thing.
  const notForward = km !== null && currentKm != null && km <= currentKm;
  const sameAsFile = km !== null && currentKm != null && km === currentKm;
  // ⚠️ WARNS, NEVER BLOCKS. "Higher" is not "plausible": LUR304 was about to take +49,407 km in a
  // single day because it was strictly greater than what FG held (2026-08-31). But MCM563 really did
  // 787 km/day for four days, so refusing a fast reading would be worse than the bug — this only
  // ever says "look again". See lib/odometer.checkOdometerJump.
  // ⚠️ `unit` is passed, and it was not. A US car reads MILES: without it the guard compared a
  // mileage delta against a km/day ceiling AND said "km" in the warning — a wrong unit inside the
  // one message whose entire job is catching a wrong number. Found 2026-09-01 when FG's second US
  // car arrived. Third instance of this exact miss in this component's history; see the `isUs`
  // prop comment above.
  const jump = km !== null ? checkOdometerJump(km, currentKm, currentAt, new Date(), unit) : null;
  // ⭐ A LOWER NUMBER HAS TWO CAUSES AND THE VALUE CANNOT TELL THEM APART: a misread (the common
  // one) or a wrong record. Aaron's `LFJ180` sat at 34,028 km off a gas sheet while the dash read
  // 28,921 — a trip meter, 3402.8, transcribed without its decimal — and the only repair was a
  // database write. So the warning still comes FIRST and still says "check the reading"; this
  // button sits beside it as the deliberate second answer.
  //
  // ⚠️ It SURFACES ITSELF, and that is the point rather than a flourish. The `Clear` built for the
  // same class of problem on 2026-08-26 shipped green and he found it a WEEK later, by accident:
  // *"I never noticed the clear until today 😅"*. A repair he has to already know about is not a
  // repair. This one appears the moment he types a number that needs it.
  const isLower = classifyOdometerEntry(currentKm, km) === 'lower';
  const offerCorrection = isLower && !!onCorrect && km !== null;

  const save = async () => {
    if (km === null || notForward) return;
    hapticLight();
    await onSave(vehicleId, km);
    setSaved(true);
  };

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        🧭 {currentKm != null ? describeOdometer(currentKm, currentAt, new Date(), unit) : 'Odometer not logged'} —
      </span>
      {/* The implausible-jump notice, rendered where he is still holding the number he typed —
          after the write it is a correction, before it is a second glance. */}
      {jump && !saved && (
        <p className="w-full text-[11px] text-amber-700 dark:text-amber-400 order-last">
          ⚠️ {jump.detail}
        </p>
      )}
      {saved ? (
        <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ {km?.toLocaleString()} {unit} saved</span>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); }}
            inputMode="numeric"
            placeholder={`${unit} on the dash`}
            aria-label="Odometer reading"
            className="w-32 h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={km === null || notForward}
            /* 44px, gloves on — the same standard as the key-count row beside it. */
            className="h-11 px-4 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-black cursor-pointer transition"
          >
            Log
          </button>
          {/* ⚠️ THE ESCAPE THE FORWARD-ONLY GUARD WAS MISSING. Save is disabled at or below the
              current reading — correct, because a LOWER reading is a misread or the wrong car. But a
              mis-typed ENTRY has to come down, and the guard cannot tell those apart. Aaron,
              2026-08-26, mid-shift: "I attached an odo reading to the wrong vehicle. how do I clear
              the one I added to LUR195" — and the honest answer was that he couldn't; it took a
              database write. A CLEAR rather than an override, his call: letting him type any number
              would weaken the guard for genuine readings, which is what it is actually good at.

              ⚠️ No confirm dialog, following the key-count row's own precedent — "make the mistake
              cheap instead of making the action expensive". Clearing IS cheap (the next scan
              re-reads it) and every touch lands in vehicle_changes either way.

              Only offered when there is something to clear, so it never appears as a control that
              does nothing. */}
          {onClear && currentKm != null && (
            <button
              type="button"
              onClick={async () => {
                setClearing(true);
                const ok = await onClear(vehicleId);
                setClearing(false);
                if (ok) setDraft('');
              }}
              disabled={clearing}
              className="h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-red-400 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40 cursor-pointer transition"
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      )}
      {/* ⚠️ Two different refusals, said differently. "Lower" is a possible MISREAD and earns red.
          "Same" is not a mistake at all — the record already says that — so it reads as a neutral
          nothing-to-do rather than an accusation. Saying "lower" for an equal value would be a small
          lie inside a message whose whole job is catching one. */}
      {notForward && !saved && (
        <span className={`text-[11px] font-semibold ${
          sameAsFile ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {sameAsFile
            ? `Already on file at ${currentKm?.toLocaleString()} ${unit} — nothing to update.`
            : `Lower than the ${currentKm?.toLocaleString()} ${unit} on file — check the reading.`}
        </span>
      )}
      {/* ⚠️ AFTER the warning, never instead of it. The first answer to a lower number is still
          "you may have misread"; this is the second answer, for when he has looked again and the
          RECORD is what is wrong. A separate control, its own words, its own tap — his 2026-08-26
          ruling that a free-typing override "would weaken the backwards guard for genuine
          readings" holds, because Log is still forward-only and this is not Log. */}
      {offerCorrection && !saved && (
        <button
          type="button"
          onClick={async () => {
            if (km === null) return;
            hapticLight();
            setCorrecting(true);
            const ok = await onCorrect!(vehicleId, km);
            setCorrecting(false);
            // ⚠️ Only claims success when the write actually landed — the R61/R62 lesson, and the
            // same reason `save` cannot simply assume. A correction that silently failed while the
            // screen said "saved" would leave the wrong number on a car he believes he fixed.
            if (ok) setSaved(true);
          }}
          disabled={correcting}
          className="w-full h-11 px-4 rounded-lg border border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300 disabled:opacity-40 cursor-pointer transition"
        >
          {correcting
            ? 'Correcting…'
            : `The record is wrong — correct it to ${km?.toLocaleString()} ${unit}`}
        </button>
      )}
    </div>
  );
}
