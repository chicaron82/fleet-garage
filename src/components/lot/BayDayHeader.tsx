// The bay log's day header (docs/ticket-lot-lookout-bay-log.md, Phase 2): ‹ the day › and, under it, his shift's crew
// in blocks: VSAs on, numbers only, never names (his rulings, 2026-10-29). The stepper is the Schedule's own: ‹, the
// label, "Today" when he's stepped away, and › kept rightmost so repeated taps keep going the same way.
//
// Quiet states, said plainly: a day he wasn't on has no record (*"the data really revolves around my shift and when i
// work"*), and today after his shift the log says when it ended.
import { dayStatus, type BayDayCrew } from '../../lib/bayCrewBlocks';

const ARROW = 'w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm disabled:opacity-30 disabled:cursor-default';

const clockOfMs = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function BayDayHeader({ label, isToday, canForward, onBack, onForward, onToday, crew, nowMs }: {
  label: string; isToday: boolean; canForward: boolean;
  onBack: () => void; onForward: () => void; onToday: () => void;
  crew: BayDayCrew | null; nowMs: number;
}) {
  const status = dayStatus(crew, isToday, clockOfMs(nowMs));
  return (
    <section aria-label="The day" className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="The day before" className={ARROW} onClick={onBack}>‹</button>
        <span className="flex-1 text-center text-sm font-bold text-gray-800 dark:text-gray-200">{label}</span>
        {!isToday && (
          <button type="button" onClick={onToday} className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer">
            Today
          </button>
        )}
        <button type="button" aria-label="The day after" className={ARROW} onClick={onForward} disabled={!canForward}>›</button>
      </div>
      {status && <p className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{status}</p>}
      {crew?.working && crew.blocks.length > 0 && (
        <ol aria-label="VSAs on during your shift" className="flex flex-wrap justify-center gap-1.5">
          {crew.blocks.map(b => (
            <li key={b.start} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs tabular-nums text-gray-700 dark:text-gray-300">
              {b.start}–{b.end} · <span className="font-bold">{b.vsas} VSA{b.vsas === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
