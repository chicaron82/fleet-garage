import { useState } from 'react';
import { zoneEvidence, zoneLabel } from '../../lib/damageZones';
import { DamageZoneMap } from './DamageZoneMap';
import { PhotoLightbox } from '../shared/PhotoLightbox';
import type { Hold } from '../../types';

// Tap a panel, see what is actually on it.
//
// Aaron, 2026-08-25: *"mapping the damage photo to the zone. so when i scan a car and the map shows
// up where damage exists, i could tap the zone and it would show me the photo of the damage at that
// zone."*
//
// ⭐ WHY THIS IS NOT A CONVENIENCE. The map has answered WHERE since 2026-08-22 and has never
// answered WHICH — and "which" is the question that cost real data on LUR184: three holds on one
// car all reading "Windshield chip", a picker that rendered the field they SHARED and hid the two
// that differed, and a live bumper scratch marked repaired off the back of it. The photo is the
// discriminator, and it was already sitting on the same row as the zone the whole time.
//
// ⭐ NOTHING NEW IS STORED. `damage_zones` and `photos` are columns on the same hold, so the zone
// IS the index — see `zoneEvidence`. No migration, no backfill, and no second copy of the truth to
// drift out of sync with the map beside it.
//
// ⚠️ REVEAL ON TAP, NEVER A GALLERY. On the scan sheet "Start trip" and "Scan another" are what he
// opened the sheet to press, and every pixel spent before them is a pixel in his way. Nothing here
// renders until he asks for it, so the common path — a clear car, or a glance at the panels — costs
// exactly what it did before.

interface Props {
  /** The car's holds. Filtering to what still stands happens in `zoneEvidence`, once. */
  holds: readonly Hold[];
  /** The panels the map is painting — from `vehicleDamageZones`, so the two always agree. */
  zones: readonly string[];
  /** Scan-sheet sizing: tighter type and spacing. The MAP is full width either way — see below. */
  compact?: boolean;
}

export function DamageZoneInspector({ holds, zones, compact = false }: Props) {
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const evidence = zoneEvidence(holds);
  const found = openZone ? evidence[openZone] ?? [] : [];

  // A panel the map has not painted carries nothing, so it stays inert rather than opening an empty
  // drawer. Painted ⇔ has evidence, because both sides come from `standingZonedHolds`.
  const tap = (id: string) => {
    if (!zones.includes(id)) return;
    setOpenZone(current => (current === id ? null : id));
  };

  return (
    <div data-testid="damage-zone-inspector">
      {/* ⚠️ NO WIDTH CAP. The scan sheet's diagram used to be capped at 13rem because it was a
          `disabled` picture nobody touched. This makes it a TAP TARGET, hit with nitrile gloves on,
          and every other site where the map takes input is full width. Aaron caught exactly this
          shrink on 2026-08-25 — "may i ask why it was made smaller than the regular map" — and
          keeping the cap here would re-commit it one file over. Scrolling is what a long sheet is
          for; a target he has to hit accurately is not the thing to shrink. */}
      <DamageZoneMap
        selected={zones}
        onToggle={tap}
        focused={openZone}
        label="Car diagram — tap a marked panel to see the damage recorded there"
      />

      {openZone && (
        <div className={`mt-2 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
             data-testid="zone-evidence">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {zoneLabel(openZone)}
            </p>
            <button type="button" onClick={() => setOpenZone(null)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
              Close
            </button>
          </div>

          {found.map(e => (
            <div key={e.holdId} className="mt-2 first:mt-1.5">
              {/* Description + date + status together, on purpose: these are precisely the fields
                  the LUR184 picker withheld, and they are what tells two holds on one panel apart
                  when the photos look alike. */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {e.damageDescription}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                  {e.status.toLowerCase()} · flagged {e.flaggedAt.slice(0, 10)}
                </span>
              </div>

              {e.photos.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.photos.map((src, i) => (
                    <button key={src} type="button"
                            onClick={() => setLightbox({ photos: e.photos, index: i })}
                            className="cursor-pointer block">
                      <img src={src} alt={`${e.damageDescription} — photo ${i + 1}`}
                           className="h-16 w-16 rounded-lg border border-gray-200 object-cover transition hover:opacity-80 dark:border-gray-800" />
                    </button>
                  ))}
                </div>
              ) : (
                // ⚠️ A DEAD TAP IS WORSE THAN NO TAP. 4 zoned holds carry no photo; a painted panel
                // that swallows a tap in silence reads as broken software. Say it plainly — and the
                // description and date above are still the thing he came for.
                <p className="mt-1 text-[11px] italic text-gray-400 dark:text-gray-500">
                  No photo on this one.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <PhotoLightbox photos={lightbox.photos} initialIndex={lightbox.index}
                       onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
