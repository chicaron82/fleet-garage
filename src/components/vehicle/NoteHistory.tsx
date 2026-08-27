import { pastNoteEpisodes, type NoteEpisode } from '../../lib/noteHistory';
import { useVehicleChanges } from '../../hooks/useVehicleChanges';
import { fmtRelativeDate } from '../../lib/lostFoundDate';

// The notes this car USED to carry — Aaron, 2026-08-26, on LZM533: *"just something on the FG's
// record that happens to show it went somewhere on this date to get repaired. then got cleared on
// this date when the vehicle showed up with no more visible damage."*
//
// ⚠️ Rendered whether or not there is a CURRENT note, which is the whole point: LZM533 has no note
// now — he cleared it when the car came back — and it is exactly the car whose history he wanted.
// Hanging this off the presence of a live note would hide it in the only state that matters.
//
// Quiet by construction: nothing renders at all when there is no past note, which is almost every
// car. Same reasoning as VehicleNote's empty state — a loud empty row on every record teaches him
// to scroll past the one car that has something.
export function NoteHistory({ vehicleId }: { vehicleId: string }) {
  const changes = useVehicleChanges(vehicleId);
  const past = pastNoteEpisodes(changes);
  if (past.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Past notes
      </p>
      {past.map((ep, i) => <PastNote key={`${ep.clearedAt}-${i}`} episode={ep} />)}
    </div>
  );
}

function PastNote({ episode }: { episode: NoteEpisode }) {
  return (
    <p className="text-[11px] text-gray-500 dark:text-gray-400 break-words">
      <span className="text-gray-600 dark:text-gray-300">📝 {episode.text}</span>
      {' — '}
      {/* ⚠️ A start we don't have is SAID, not guessed. The change log is capped, so an old episode
          can be missing its opening row; "cleared <date>" is the honest shorthand for that, and
          inventing a start would be a small lie in the one place meant to be a record. */}
      <span className="tabular-nums">
        {episode.setAt
          ? `${fmtRelativeDate(episode.setAt)} → ${fmtRelativeDate(episode.clearedAt!)}`
          : `cleared ${fmtRelativeDate(episode.clearedAt!)}`}
      </span>
    </p>
  );
}
