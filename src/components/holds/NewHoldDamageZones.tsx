import { ZoneMapPicker } from './ZoneMapPicker';
import { zoneLabel, presetFor } from '../../lib/damageZones';
import { hapticLight } from '../../lib/haptics';

interface Props {
  holdTypes: readonly string[];
  zones: readonly string[];
  onToggleZone: (id: string) => void;
  noPanelApplies: boolean;
  onNoPanelApplies: (v: boolean) => void;
}

/**
 * ⭐ The zone map, on the form, while he is still standing at the damage.
 *
 * Aaron, 2026-08-24: *"right now i flag it, then when i go back to the hold i have to add it to
 * the map."* The zone backfill queue exists only because zones weren't collected here — every hold
 * flagged became an item to work later, so the queue refilled as fast as it drained. Asking at the
 * car turns a permanent chore into a shrinking backlog.
 *
 * ⚠️ AN UNTOUCHED MAP MUST STILL ENQUEUE. That is the whole safety of this screen. If silence
 * counted as "reviewed", a hold he simply scrolled past would be indistinguishable from one he
 * deliberately marked as having no panel — and the queue, which is the only thing that would ever
 * catch it again, would never see it. So "No panel applies" is an explicit tap, and saying nothing
 * means *not yet*.
 *
 * ⚠️ The preset is an OFFER, never a default — same rule `presetFor` states for the hold screen:
 * a deliberate tap is a person saying "I looked". A pre-selection says nothing and looks the same.
 */
export function NewHoldDamageZones({ holdTypes, zones, onToggleZone, noPanelApplies, onNoPanelApplies }: Props) {
  const preset = presetFor(holdTypes);
  const presetUnused = preset && !preset.zones.every(z => zones.includes(z));

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Where on the car
          <span className="ml-1 normal-case font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        {zones.length > 0 && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{zones.length} marked</span>
        )}
      </div>

      {/* Full width, like every other place the map is TAPPED — the hold screen, the backfill run,
          the vehicle record. It was briefly capped at 13rem, copied from the scan sheet, where the
          map is a `disabled` picture nobody touches (Aaron, straight away: *"may i ask why it was
          made smaller than the regular map"*). The worry was the submit button falling below the
          fold, but the answer to a long form is scrolling, not shrinking the target he has to hit
          with gloves on — and the backfill view proves full width works on his phone. */}
      <div>
        <ZoneMapPicker
          selected={zones}
          onToggle={id => { hapticLight(); onToggleZone(id); }}
          disabled={noPanelApplies}
          candidates={noPanelApplies ? [] : (preset?.zones ?? [])}
        />
      </div>

      {zones.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {zones.map(z => (
            <span key={z} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-700 dark:text-gray-300">
              {zoneLabel(z)}
            </span>
          ))}
        </div>
      )}

      {presetUnused && !noPanelApplies && (
        <button
          type="button"
          onClick={() => { hapticLight(); preset.zones.forEach(z => { if (!zones.includes(z)) onToggleZone(z); }); }}
          className="text-[11px] text-indigo-700 dark:text-indigo-400 underline cursor-pointer"
        >
          Use {preset.label}
        </button>
      )}

      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={noPanelApplies}
          onChange={e => { hapticLight(); onNoPanelApplies(e.target.checked); }}
          className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-400 cursor-pointer"
        />
        <span className="text-[11px] text-gray-600 dark:text-gray-400">
          No panel applies — it isn&apos;t on the diagram
        </span>
      </label>
    </div>
  );
}
