// The Erin pill's sheet: Erin St's count, built to Aaron's own layout (2026-10-16 23:01, after a real shift with the
// old card: *"it's too complex to use fast and on the fly"* ... *"having to switch back to my day and scroll to the
// bottom to update the cleans and dirties after each vehicle and driver drain was a lot of taps and swipes"*):
//
//   [ - ]     9      [ + ]
//   [drain][input][set][0]          ← cleans
//   [ - ]     9     [ + ]
//   [0][input][set][fill]           ← dirties
//
// *"no need for the text hint in the input boxes"*. DRAIN and FILL move one car per driver on right now (*"saw eugene,
// john and robert all are working and in their shift window. tap the drain and removes 3"*), read from the crew line
// only while this sheet is open. Since 2026-10-24 that is the schedule: no present tap needed. Copy is exactly "7/3": *"when asked what the count is, i
// reply with "7/3""*. Set, 0, drain and fill carry an Undo on the note for 5 s. Ticket:
// docs/ticket-lot-lookout-too-slow-on-the-fly.md.
import { useEffect } from 'react';
import { hapticLight } from '../../lib/haptics';
import type { LotBayState } from '../../hooks/useLotBay';
import { useBayTapsSignedIn } from '../../hooks/useBayTaps';
import { ErinCountBlocks, UndoNoteBar } from './ErinCountBlocks';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useUndoNote } from '../../hooks/useUndoNote';

export function ErinCountSheet({ erin, by, onClose }: { erin: LotBayState; by: string; onClose: () => void }) {
  const [note, show, clearNote] = useUndoNote();
  const taps = useBayTapsSignedIn(erin, show, by);
  const { crew } = useLotCrew({ signedIn: true });
  const drivers = crew?.summary.driver.on ?? 0;
  const bay = erin.bay;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!bay) return null;
  const copyText = `${bay.cleans}/${bay.dirties ?? '–'}`;
  const copy = () => {
    hapticLight();
    const failed = () => show(`Copy did not work here. It's ${copyText}`);
    if (!navigator.clipboard) { failed(); return; }
    navigator.clipboard.writeText(copyText).then(() => show(`Copied ${copyText}`), failed);
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Erin St count">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 w-full bg-black/45 cursor-default" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-2xl border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-2.5 space-y-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Erin St</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500 dark:text-gray-400 cursor-pointer px-1">Done</button>
        </div>

        <ErinCountBlocks erin={erin} taps={taps} drivers={drivers} />

        <button type="button" onClick={copy}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-bold text-black cursor-pointer">
          Copy <span className="font-mono">{copyText}</span>
        </button>

        <UndoNoteBar note={note} clear={clearNote} />
      </div>
    </div>
  );
}
