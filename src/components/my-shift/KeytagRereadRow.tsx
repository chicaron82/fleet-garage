// "Re-read the stored tags" — one row inside the key-tag audit section.
//
// ⭐ Aaron, holding a 45-car queue whose blanks FG had already read off the photos: *"having to find
// 45 keytags from ~150 to reupload is a hassle lol isn't there a better solution. can't it just be
// re-read and filled out? leaving the key count?"* It can — the photos are on the records.
//
// ⚠️ ITS OWN FILE because the audit section is a queue surface and this is a bulk job with its own
// progress, counts and spend warning. Folding it in would have pushed a 96-line file past 130 for
// a control that has nothing to do with the car currently on screen.
import { useKeytagReread } from '../../hooks/useKeytagReread';

export function KeytagRereadRow() {
  const { running, progress, filled, fieldsFilled, disagreed, failed, candidates, run } = useKeytagReread();
  const ran = progress !== null && !running;

  if (candidates === 0 && !ran) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          🔁 Re-read the stored tags
        </span>
        {/* ⚠️ THE COUNT IS THE PRICE, and it is shown BEFORE the tap for that reason: every car here
            is one model call on Aaron's own API key. A bulk job that spends his budget without
            naming the size first is the mistake that broke his scanner mid-shift once already. */}
        <button type="button" disabled={running || candidates === 0} onClick={run}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 disabled:opacity-50 cursor-pointer">
          {running ? `Reading… ${progress?.done ?? 0} / ${progress?.total ?? 0}` : `Read ${candidates} tag${candidates === 1 ? '' : 's'}`}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Reads the photos already on these records and fills the blanks — owning area, model code,
        VIN. It never overwrites a value that is already there, and never touches the key count:
        that one is counted off the ring, so it stays yours.
      </p>
      {ran && (
        <p role="status" className="text-[11px] text-gray-600 dark:text-gray-300 tabular-nums">
          Filled <strong>{fieldsFilled}</strong> field{fieldsFilled === 1 ? '' : 's'} across <strong>{filled}</strong> car{filled === 1 ? '' : 's'}.
          {disagreed > 0 && <> <span className="text-amber-700 dark:text-amber-400">{disagreed} disagreed with what was on file — left alone for your eyes.</span></>}
          {failed > 0 && <> {failed} photo{failed === 1 ? '' : 's'} could not be read.</>}
        </p>
      )}
    </div>
  );
}
