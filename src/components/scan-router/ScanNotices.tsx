import { isUnknownClassCode } from '../../lib/partialRegister';
import { vinFindings, vinFindingHint } from '../../lib/vinChecks';
import { checkOwningCity, owningLabel } from '../../../api/_lib/owningArea';
import { nearMissClassCode, describeNearMiss } from '../../../api/_lib/classCodeCandidates';
import type { KeytagRead } from '../../../api/_lib/keytagRead';
import type { Vehicle } from '../../types';

/**
 * Everything a scan wants to TELL him, in one place.
 *
 * ⭐ WHY IT IS ITS OWN FILE. `ScanRouterOverlay` hit the 330-line cap the moment the third notice
 * landed, and the cap did exactly what it is for: it turned "this file is long" into a real module
 * rather than into deleted documentation. Three notices is also the point at which they stop being
 * incidental lines and start being a concern — *what does FG know about this car that he should hear
 * while he is standing at it?*
 *
 * ⚠️ Every one of them REPORTS AND NEVER ACTS. A scan is a moment of attention, not a moment of
 * decision: the codex is not taught here, the owning area is not corrected here, and the photo is
 * not replaced here. Each says what it knows and leaves the doing to him.
 */
export function ScanNotices({ scanRead, vehicle, codexToast }: {
  scanRead: KeytagRead | null;
  /** The matched car, when the plate resolved to one. */
  vehicle: Vehicle | null;
  /** Set when this very scan TAUGHT the codex — suppresses the unknown-code notice. */
  codexToast: string;
}) {
  return (
    <>
          {/* Say WHY registration degraded. Before this the scan just quietly offered less
              and the operator had to infer the cause from the shape of the failure.
              Suppressed when the scan TAUGHT the code instead — asking him to add by hand
              what FG just learned by itself is the exact confusion this pair replaced. */}
          {/* ⭐⭐ A CODE FG DOES NOT KNOW IS SOMETIMES A MISREAD OF ONE IT DOES. Measured 2026-08-29:
          of 25 stored tags re-read, two disagreed with the record and NEITHER misread was a real
          code — CJCL read as CJCI (one character, L→I), CKSE as CRSR. Both would land here, on the
          notice that invites him to add the code by hand, which is precisely how CC59, CK45 and CN
          were born: a misread enshrined at the moment of doubt.

          ⚠️ It raises doubt and never corrects. The nearest code is often the WRONG one — CRSR is
          one character from CRSV, a different car entirely — so "did you mean" would be confidently
          wrong. "Read the tag again" is true either way, and it is the part that matters.

          ⚠️ Curated codes only: a TAUGHT code one character away is not seen from the client. That
          errs toward silence, which is the correct direction for a warning. */}
      {scanRead && isUnknownClassCode(scanRead) && !codexToast
        && nearMissClassCode(scanRead.classCode).candidates.length > 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
          ⚠️ {describeNearMiss(nearMissClassCode(scanRead.classCode))}.
        </p>
      )}
      {scanRead && isUnknownClassCode(scanRead) && !codexToast
        && nearMissClassCode(scanRead.classCode).candidates.length === 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              Model code <span className="font-mono font-semibold">{scanRead.classCode}</span> isn’t in the codex yet —
              make/model need adding by hand. Logged for DiZee.
            </p>
          )}
          {/* ⭐⭐ THE TAG DISAGREEING WITH ITSELF. The top line carries a city AND a number,
              and until tonight FG read both and kept only the number. That matters because
              8199 is 284 of 365 cars — seven to one, permanently, because the branch is in
              Manitoba — so a single-character misread toward it (8193→8199 is 3↔9; 8198→8199
              is 8↔9) is one more vote for the majority it hides in. No check that counts can
              see it. Aaron found three by eye on 2026-08-28, off the stored photos.

              ⚠️ It reports, it never corrects. The tag holds both halves and only a person
              can say which one won — and an unknown city is a new branch, not a conflict. */}
          {/* ⭐⭐ THE RETAKE WATCHLIST, SURFACED WHERE IT IS ACTIONABLE. Aaron asked for
              this shape on 2026-08-27: *"I pictured it like the geotab watch list. anytime I
              scan one that is on that list it tells me."* The flag has been written by the
              auditor since migration 130 and read by NOTHING at scan time — a column with a
              writer and no reader on the surface that matters. The point was never the list;
              it was being told AT THE CAR, holding the tag, where a fresh photo costs one tap
              and where a flag he only sees by opening a record is a flag seen too late. */}
          {vehicle?.keytagAuditResult === 'unreadable' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              🏷️ You couldn't read this tag last time — grab a fresh photo while you're here.
              Retaking it also puts the car back in the audit queue.
            </p>
          )}
          {/* ⚠️ A DIFFERENT ERRAND, SO A DIFFERENT SENTENCE. 'stale' means the stored photo is
              perfectly legible and belongs to a tag this car no longer wears — set automatically
              when a re-plate is adopted (context/plateWrite). Telling him "you couldn't read this"
              would send him looking for a blur that is not there; what he actually needs to know is
              that the tag in his hand is the NEW one and the photo on file is not. */}
          {vehicle?.keytagAuditResult === 'stale' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              🏷️ The photo on file is an older tag — this car was re-plated. Snap the one in your
              hand while you're here; that clears the flag and re-queues the audit.
            </p>
          )}
          {/* ⭐⭐ THE TAG IS FINE AND STILL CANNOT ANSWER — so point at a different SOURCE, not a
              better picture. Aaron, 2026-09-13, after five of thirteen tag photos turned out to be
              untranscribable: *"wanna flag both priuses so the next scan will let me know to check
              other sources on the vehicle. like what the barcode sticker has... also for the
              handwritten ones to check for the VIN."*

              ⚠️ IT MUST NOT READ LIKE THE TWO ABOVE. Both of those end in "take a photo", and that
              is the one instruction that cannot work here: 728NVJ and DEWN854 wear HAND-WRITTEN
              replacement tags with no `Last9vin:` line printed on them at all. The camera is not
              the missing piece; the door jamb is.

              ⭐ THE SECOND SENTENCE IS DERIVED, NOT STORED — it says what FG HOLDS, and deliberately
              says nothing about what the tag prints. Storing the reason would let it rot; asserting
              the tag's contents would be worse, and was: the first cut of this read *"FG has no VIN
              for it, and this tag doesn't carry one."*

              ⚠️⚠️ THAT SECOND CLAUSE WAS FALSE ON THE VERY CAR IT WAS WRITTEN FOR. I had LZM516 and
              LZM539 as one re-plated Prius; Aaron, 2026-09-13: *"they're two different vehicles with
              the same unit and VIN. that's why i wanted the flag on both."* So LZM539's tag DOES
              print `0T3076384` — it is simply another car's, and FG cannot store it because LZM516
              already has it. He would have been standing at the car holding a tag with a VIN on it
              while FG insisted there wasn't one. A notice that describes evidence in his hand can be
              contradicted by it; one that describes FG's own record cannot. */}
          {vehicle?.keytagAuditResult === 'check-vehicle' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              🔎 The tag can’t settle this one — read the barcode sticker in the door jamb.{' '}
              {vehicle.vinLast9
                ? <>FG has <span className="font-mono font-semibold">{vehicle.vinLast9}</span> on file;
                    confirm the sticker agrees before trusting it.</>
                : <>FG has no VIN on file for it — take it off the sticker, not the tag.</>}{' '}
              A fresh photo of the tag won’t help.
            </p>
          )}
          {/* ⭐⭐ TELL HIM AT THE CAR, WHICH IS THE ONLY PLACE THIS IS ACTIONABLE. Aaron, 2026-08-30,
              after I had put the VIN checks on the vehicle record instead: *"the scanner worked
              perfectly, i just needed the flag on it so the next time i see it, the scan will tell
              me to recheck the VIN."*

              He is right, and the record was the wrong surface. A VIN he can only see by opening a
              record is a VIN he checks at a desk — where he cannot look at the door jamb. Standing
              at the car with the tag in his hand is the one moment the fix costs nothing. Same
              shape as the retake flag above, and the same reason.

              ⚠️ It reads the STORED VIN, not this scan's. On LFJ400 the tag itself prints the bad
              value, so a fresh read reproduces it exactly — the notice has to fire every time that
              car comes through, not only when something changes. */}
          {(() => {
            const f = vehicle ? vinFindings(vehicle.vinLast9, vehicle.year)[0] : null;
            return f ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                🔖 Recheck the VIN — stored as{' '}
                <span className="font-mono font-semibold">{vehicle!.vinLast9}</span>. {f.detail}{' '}
                {vinFindingHint(f)}
              </p>
            ) : null;
          })()}
          {(() => {
            const c = scanRead && checkOwningCity(scanRead.owningCity, scanRead.owningArea);
            return c && c.kind === 'conflict' ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                ⚠️ This tag disagrees with itself — it reads{' '}
                <span className="font-mono font-semibold">{c.city}</span> but the number is{' '}
                <span className="font-mono font-semibold">{c.owningArea}</span> ({owningLabel(c.owningArea)}).{' '}
                {c.city} is {c.expected.map(e => owningLabel(e)).join(' or ')}. Check the tag before this is stored.
              </p>
            ) : null;
          })()}
    </>
  );
}
