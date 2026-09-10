// The scan sheet's car card: WHAT the car is and its state — identity, status, what is wrong with
// it and where, keys / EV kit / odometer, and every "FG noticed something" line under them.
//
// Lifted out of ScanRouterOverlay on 2026-09-10. Adding the 🔍 typing door would have pushed that
// file further past the 330 cap (it was already at 455), and this card was always its biggest
// separable beat. The overlay owns the read, the pipeline, the menu and the routing; this only
// shows the result it is handed.
//
// ⚠️ The plate-watch banner does NOT live here, deliberately. It must render even when no car
// resolved, BEFORE the result block — tests/architecture/plate-watch-reach-contract asserts that
// against the overlay, and moving it in here would silently gate it on a resolved vehicle.
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { ScanReplateOffer } from './ScanReplateOffer';
import { ScanDamageZones } from './ScanDamageZones';
import { ScanNotices } from './ScanNotices';
import { ScanVehicleCapture } from './ScanVehicleCapture';
import { VehicleName } from '../shared/VehicleName';
import { Sparkles } from '../shared/Sparkles';
import { scanStatusLine, TONE_TEXT, TONE_BLOCK } from '../../lib/scanStatusLine';
import { evAssetScanStatus } from '../../lib/ev-detection';
import { flaggedOnLabel } from '../../lib/scanHoldSummary';
import { cycleLabel, type ConsolidatedDamage } from '../../lib/consolidateDamage';
import { matchedByUnitLabel, isPlateMismatch } from '../../lib/matchByUnitNumber';
import type { KeytagScanResult } from '../../lib/resolveKeytagScan';
import type { KeytagRead } from '../../../api/_lib/keytagRead';

interface Props {
  scanRead: KeytagRead | null;
  result: KeytagScanResult;
  /** One line per defect (consolidateDamage) — the overlay needs the same list for its menu. */
  holdLines: ConsolidatedDamage[];
  scanNonce: number;
  /** Whether the menu below offers "Register" — shapes the not-in-the-fleet line. */
  canRegister: boolean;
  /** Two live cars share the scanned unit and the plate was unreadable: open the one he picks. */
  onPickCandidate: (vehicleId: string) => void;
  geotabPending: boolean;
  backfillToast: string | null;
  conflictToast: string | null;
  codexToast: string;
}

export function ScanIdentityCard({
  scanRead, result, holdLines, scanNonce, canRegister, onPickCandidate,
  geotabPending, backfillToast, conflictToast, codexToast,
}: Props) {
  const { holds, recordKeyCount, recordOdometer, clearOdometer, correctOdometer, updateVehicleEVAssets, adoptPlate } = useVehicleHoldContext();
  const vehicle = result.vehicle ?? null;
  // NOT "active" — holdLines is ACTIVE **or RELEASED** since 2026-08-17. The old name is what let
  // a released hold speak as though it were holding the car. Count only; never the label.
  const liveHolds = holdLines.length;
  // EV-kit status surfaced at scan (tag in hand) for Teslas with asset records — the charge cable +
  // adapter walk off easily, so "last seen missing the cable" the moment you scan = check it NOW.
  const evScan = vehicle ? evAssetScanStatus(vehicle) : null;

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
      {result.wasCorrected && result.rawPlate && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Read <span className="font-mono">{result.rawPlate}</span> → corrected to <span className="font-mono font-semibold">{result.plate}</span>
        </p>
      )}
      <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
        {/* ⭐ Once a vehicle RESOLVED, its record is authoritative for the plate — not the
            tag read. Two reasons, and the second one is new:
              • On a unit-number match the tag had no readable plate at all, and handing
                the record's plate back is the entire point of that fallback.
              • The reader now runs a cheap model first (api/keytag-read.ts), which is
                ~87.5% on plates against ~97.5% on unit numbers. So a read can resolve
                correctly VIA THE UNIT while carrying a misread plate — roughly 1 in 8.
                Showing the read's plate there would print a plate the car doesn't have,
                on a card he uses to identify the car in his hand.
            An UNresolved read still shows what was read, because that's all there is. */}
        {vehicle?.licensePlate || result.plate || ''}{vehicle?.unitNumber ? ` · Unit ${vehicle.unitNumber}` : ''}
      </p>
      {vehicle ? (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {/* ⚠️ Same miss as the record header, and worse here: this is the sheet he is
                reading STANDING AT THE CAR, deciding what it is. `VehicleName`'s own
                header calls that out by name — "above all the scan sheet" — and the scan
                sheet was still joining the fields by hand. */}
            <VehicleName vehicle={vehicle} />{vehicle.color ? ` · ${vehicle.color}` : ''}
          </p>
          {/* Derived from the vehicle's STATUS, never from the hold count — see
              scanStatusLine.ts. The count only adds a suffix. */}
          {(() => {
            const line = scanStatusLine(vehicle.status, liveHolds);
            return <p className={`text-xs font-semibold mt-0.5 ${TONE_TEXT[line.tone]}`}>{line.text}</p>;
          })()}
          {/* WHAT'S WRONG WITH IT — Aaron's ask (2026-08-16), the last gap in this card.
              The overlay always had these holds in scope and counted them into "On hold
              (2)", dropping the description: it said something's wrong, then made him
              open the record to find out what. Now the tag tells him "Damage · Windshield
              chip" while he's standing at the car, so he can verify it's still there or
              already fixed without a detour. A hold the car went OUT on is called out
              loudest — that's the old-damage amnesia FG exists to prevent. */}
          {holdLines.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {holdLines.map(l => (
                /* Tone follows the VEHICLE's status, not the hold's existence — an
                   on-exception hold still overrides to amber because that car is out
                   carrying the damage right now, which is the one thing worth shouting
                   about regardless of what the record says. */
                <div key={l.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                  l.onException
                    ? TONE_BLOCK.amber
                    : TONE_BLOCK[scanStatusLine(vehicle.status, liveHolds).tone]
                }`}>
                  <p className="font-semibold">
                    {l.onException ? '⚠️ Out on exception' : '🔧'} {l.typeLabel}
                    {/* One cycle reads as before. Several say so, with the date it was
                        FIRST put on record — which is what "pre-existing" actually means,
                        and the history his re-flagging deliberately created. */}
                    <span className="font-normal opacity-70">
                      {' · '}{cycleLabel(l, flaggedOnLabel) || `flagged ${flaggedOnLabel(l.lastFlaggedAt)}`}
                    </span>
                  </p>
                  {l.detail && <p className="mt-0.5">{l.detail}</p>}
                </div>
              ))}
            </div>
          )}

          {/* WHERE it is — the other half of the hold lines above, which say only WHAT.
              Silent on a car with no panels recorded (most scans). See ScanDamageZones. */}
          <ScanDamageZones holds={holds} vehicleId={vehicle.id} />

          {/* Keys, EV kit and odometer — one beat, extracted together because they
              are one beat: tag in hand, trunk open, dash lit. See ScanVehicleCapture. */}
          <ScanVehicleCapture
            vehicle={vehicle}
            scanNonce={scanNonce}
            rentalClass={(scanRead?.rentalClass ?? vehicle.rentalClass ?? '').trim()}
            recordKeyCount={recordKeyCount}
            recordOdometer={recordOdometer}
            clearOdometer={clearOdometer}
            correctOdometer={correctOdometer}
            updateVehicleEVAssets={updateVehicleEVAssets}
          />
        </>
      ) : result && result.unitCandidates.length > 0 ? (
        /* Two live cars carry the scanned unit and the plate was unreadable, so nothing
           was matched. Deliberately NOT a guess and NOT a failure — name the candidates
           and let him pick, because attaching a scan to the wrong car is the one outcome
           worse than not resolving. (Three such pairs exist in the fleet today.) */
        <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold">
            ⚠️ {result.unitCandidates.length} cars carry unit #{result.unitCandidates[0].unitNumber} — and the plate wasn’t readable.
          </p>
          {result.unitCandidates.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => onPickCandidate(v.id)}
              className="block w-full text-left rounded-lg border border-amber-300 dark:border-amber-700 px-2 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition cursor-pointer"
            >
              <span className="font-mono font-semibold">{v.licensePlate}</span>
              <span className="opacity-80"> · <VehicleName vehicle={v} /> · {v.color}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Not in the fleet{canRegister ? '' : ' — couldn’t read enough to register it'}
        </p>
      )}
      {/* Which key did the work. FG never resolves by the weaker key silently — if the
          plate was unreadable and the unit number found the car, say so. */}
      {result?.matchedByUnit && (
        /* Amber when the plate CHANGED (a re-plate needs a decision), blue when the tag
           was simply unreadable (an FYI). Same lane rule as everywhere: status vs info. */
        <p className={`text-xs font-semibold mt-1 ${
          isPlateMismatch(result.plate, vehicle?.licensePlate)
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-blue-700 dark:text-blue-400'
        }`}>
          🔎 {matchedByUnitLabel(true, scanRead?.unitNumber, result.plate, vehicle?.licensePlate)}
        </p>
      )}
      {/* ⭐ The unit fallback already RESOLVED the car; this is the one case where the
          difference between the tag's plate and the record's is a real-world event rather
          than a bad read. Renders itself away unless it classifies as a re-plate. */}
      {vehicle && (
        <ScanReplateOffer
          vehicle={vehicle}
          tagPlate={result?.plate}
          scanNonce={scanNonce}
          adoptPlate={adoptPlate}
        />
      )}
      {/* EV kit (Tesla) — last-seen status of the charge cable + J1772 adapter, surfaced at
          the car so a missing one gets caught the moment the tag is read, not at dispatch. */}
      {evScan && (
        evScan.kind === 'complete' ? (
          <p className="text-xs font-semibold mt-1 text-green-700 dark:text-green-400">⚡ EV kit — last seen complete (cable + adapter)</p>
        ) : (
          <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">
            ⚡ EV kit — last seen missing: {evScan.missing.map(m => (m === 'cable' ? 'charge cable' : 'J1772 adapter')).join(' + ')}
          </p>
        )
      )}
      {/* Geotab install watchlist — separate axis from holds/exception; must hold until installed. */}
      {geotabPending && (
        <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">📡 On the Geotab install list — hold until a unit is installed</p>
      )}
      {/* Never fill silently — name exactly what the tag just landed on the record. */}
      {backfillToast && (
        /* ⭐ Sparkled IN PLACE rather than promoted to a Toast: this line is CONTEXT he
           reads beside the card, not transient news, and a 3-second toast would cost the
           information to gain the flourish. `relative` hosts the sparkle layer. */
        <p className="relative text-xs font-semibold mt-1 text-green-700 dark:text-green-400">
          {backfillToast}<Sparkles size="0.75rem" /></p>
      )}
      {/* ...and never DISAGREE silently either. The tag in his hand is the best evidence
          FG gets; a record that contradicts it is worth a line, not a shrug. */}
      {conflictToast && (
        <p className="text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">{conflictToast}</p>
      )}
      {/* FG closed its own gap off this car's record — green, because nothing is owed. */}
      {codexToast && (
        <p className="text-[11px] font-semibold mt-1 text-green-700 dark:text-green-400">{codexToast}</p>
      )}
      <ScanNotices scanRead={scanRead} vehicle={vehicle} codexToast={codexToast} />
    </div>
  );
}
