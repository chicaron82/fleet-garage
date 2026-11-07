// The bay log's day: the chips, then every car in the order it went in. Shared by the Lot Lookout module and the
// read-only /lot/view, so the counter and the boss read the same list he does (ticket-lot-lookout-bay-log).
//
// ⚠️ One time per finished car, its EXIT time. Durations, never: *"if it shows lol it might bite me later"* (Aaron,
// 2026-10-29). And never a name: cars and times only (the 2026-10-15 /lot/view rule).
//
// Newest on top, the chips filter, and FG folds all but the last 3 (2026-11-04, bayListView.ts). The read-only link
// gets the filters and never the fold: *"Read-only gets the chips but not the fold"*.
//
// His note on a row shows here on both screens (2026-11-04: *"can be seen via the read-only link"*); writing one, and
// Flag it's "Same as the … hold", are FG's alone: only where `edit` is passed (BayLineEdit.tsx).
import { useState, type ReactNode } from 'react';
import { bayLines, baySummary, type BayLineKind, type BayLogRow } from '../../lib/lotBayLog';
import { bayListView, FOLD_KEEP, type BayFilter } from '../../lib/bayListView';
import { BayFlagChoices, BayNoteEditor, BayRemoveConfirm, type SameHoldChoice } from './BayLineEdit';

const TONE: Record<BayLineKind, string> = {
  clean: 'text-green-700 dark:text-green-400',
  erin: 'text-green-700 dark:text-green-400',
  mhold: 'text-amber-700 dark:text-amber-400',
  bhold: 'text-red-700 dark:text-red-400',
  skip: 'text-blue-700 dark:text-blue-400',
  bay: 'text-amber-800 dark:text-amber-300',
};

const CHIP = 'rounded-full px-2.5 py-1 text-xs font-bold';
const SMALL_BTN = 'mt-0.5 min-h-8 rounded-lg border border-gray-300 dark:border-gray-600 px-2 text-xs font-bold text-gray-800 dark:text-gray-100 cursor-pointer';

/** FG's writes on a finished line. Absent on the read-only link. */
export interface BayListEdit {
  /** The rows still to flag (unflaggedHoldIds). */
  flagIds: ReadonlySet<number>;
  /** The holds a row could be the same as; empty = Flag it goes straight to the form. */
  choicesFor: (id: number) => SameHoldChoice[];
  onNewHold: (id: number) => void;
  onSameHold: (id: number, holdId: string) => Promise<string | null>;
  onNote: (id: number, note: string | null) => Promise<string | null>;
  /** His delete (2026-11-06): today's list only, so absent on an earlier day. */
  onRemove?: (id: number) => Promise<string | null>;
}

export function BayLogList({ rows, readOnly = false, heading, empty = 'No cars through the bay yet today.', edit }: {
  rows: BayLogRow[]; readOnly?: boolean; heading: string; empty?: string; edit?: BayListEdit;
}) {
  const lines = bayLines(rows, { readOnly });
  const s = baySummary(rows);
  const canEdit = !!edit && !readOnly;
  // One line open at a time: a note box, or Flag it's choices.
  const [open, setOpen] = useState<{ id: number; what: 'note' | 'flag' | 'remove' } | null>(null);
  const [picked, setPicked] = useState<BayFilter | null>(null);
  const [unfolded, setUnfolded] = useState(false);
  // A filter whose last car was undone falls away with its chip, instead of leaving an empty list behind it.
  const filter = picked && s[picked] > 0 ? picked : null;
  const view = bayListView(lines, { filter, fold: canEdit && !unfolded, pinned: edit?.flagIds });
  const toggle = (f: BayFilter) => setPicked(p => (p === f ? null : f));
  const flag = (id: number) => {
    if (!edit) return;
    if (edit.choicesFor(id).length) setOpen({ id, what: 'flag' });
    else edit.onNewHold(id);
  };
  return (
    <section aria-label="Today's bay log" className="space-y-2">
      <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{heading}</h2>
      {lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center text-sm text-gray-500 dark:text-gray-400">
          {empty}
        </p>
      ) : (
        <>
          {/* Zero chips stay hidden: a "0 holds" is noise, and "0 still to do" only matters when it isn't 0. */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`${CHIP} bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200`}>{s.clean} clean</span>
            {s.erin > 0 && <FilterChip on={filter === 'erin'} onTap={() => toggle('erin')} tone="bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200">{s.erin} for Erin St</FilterChip>}
            {s.bhold > 0 && <FilterChip on={filter === 'bhold'} onTap={() => toggle('bhold')} tone="bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200">{s.bhold} {readOnly ? 'held, damage' : 'B hold'}</FilterChip>}
            {s.mhold > 0 && <FilterChip on={filter === 'mhold'} onTap={() => toggle('mhold')} tone="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{s.mhold} {readOnly ? 'held, mechanical' : 'M hold'}</FilterChip>}
            {s.stillToDo > 0 && <span className={`${CHIP} bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200`}>{s.stillToDo} still to do</span>}
          </div>
          <ol className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {view.shown.map(l => {
              const finished = l.kind !== 'bay';
              const isOpen = open?.id === l.id;
              return (
                <li key={l.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-11 shrink-0 font-mono text-xs font-bold tabular-nums text-gray-600 dark:text-gray-300">{l.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{l.plate}</span>
                      {l.car && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{l.car}</span>}
                      {l.memo && !(isOpen && open.what === 'note') && (
                        canEdit ? (
                          <button type="button" onClick={() => setOpen({ id: l.id, what: 'note' })}
                            className="block text-left text-xs text-gray-800 dark:text-gray-100 cursor-pointer">📝 {l.memo}</button>
                        ) : <span className="block text-xs text-gray-800 dark:text-gray-100">📝 {l.memo}</span>
                      )}
                      {canEdit && finished && !isOpen && (!l.memo || edit.onRemove) && (
                        <span className="flex gap-4">
                          {!l.memo && (
                            <button type="button" onClick={() => setOpen({ id: l.id, what: 'note' })}
                              className="min-h-8 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer">+ Note</button>
                          )}
                          {edit.onRemove && (
                            <button type="button" onClick={() => setOpen({ id: l.id, what: 'remove' })}
                              className="min-h-8 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer">Remove</button>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-sm font-extrabold ${TONE[l.kind]}`}>{l.label}</span>
                      {l.note && finished && <span className="block text-[11px] text-gray-500 dark:text-gray-400">{l.note}</span>}
                      {canEdit && edit.flagIds.has(l.id) && !isOpen && (
                        <button type="button" onClick={() => flag(l.id)} className={SMALL_BTN}>Flag it →</button>
                      )}
                    </span>
                  </div>
                  {canEdit && isOpen && open.what === 'note' && (
                    <BayNoteEditor initial={l.memo} onSave={note => edit.onNote(l.id, note)} onClose={() => setOpen(null)} />
                  )}
                  {canEdit && isOpen && open.what === 'remove' && edit.onRemove && (
                    <BayRemoveConfirm what={`${l.plate} · ${l.label} ${l.time}`} onRemove={() => edit.onRemove!(l.id)} onClose={() => setOpen(null)} />
                  )}
                  {canEdit && isOpen && open.what === 'flag' && (
                    <BayFlagChoices choices={edit.choicesFor(l.id)} onSame={holdId => edit.onSameHold(l.id, holdId)}
                      onNew={() => { setOpen(null); edit.onNewHold(l.id); }} onClose={() => setOpen(null)} />
                  )}
                </li>
              );
            })}
            {view.folded.length > 0 && (
              <li>
                <button type="button" onClick={() => setUnfolded(true)}
                  className="w-full min-h-11 px-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                  ▾ {view.folded.length} earlier
                </button>
              </li>
            )}
          </ol>
          {canEdit && unfolded && !filter && lines.filter(l => l.kind !== 'bay').length > FOLD_KEEP && (
            <button type="button" onClick={() => setUnfolded(false)}
              className="min-h-9 px-1 text-xs font-bold text-gray-500 dark:text-gray-400 cursor-pointer">▴ Fold the list</button>
          )}
        </>
      )}
    </section>
  );
}

/** A count chip that filters the list to its kind. Tap again for all. */
function FilterChip({ on, onTap, tone, children }: { on: boolean; onTap: () => void; tone: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onTap}
      className={`${CHIP} ${tone} cursor-pointer touch-manipulation ${on ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-gray-100 dark:ring-offset-gray-900' : ''}`}>
      {children}
    </button>
  );
}
