// The Erin pill's sheet: Erin St's count, built to Aaron's own layout (2026-10-16 23:01, after a real shift with the
// old card: *"it's too complex to use fast and on the fly"* ... *"having to switch back to my day and scroll to the
// bottom to update the cleans and dirties after each vehicle and driver drain was a lot of taps and swipes"*):
//
//   [ - ]     9      [ + ]
//   [drain][input][set][0]          ← cleans
//   [ - ]     9     [ + ]
//   [0][input][set][fill]           ← dirties
//
// *"no need for the text hint in the input boxes"*. DRAIN and FILL move one car per driver on right now running to the
// airport (*"saw eugene, john and robert all are working and in their shift window. tap the drain and removes 3"*),
// read from the crew line only while this sheet is open. Copy is exactly "7/3": *"when asked what the count is, i
// reply with "7/3""*. Set, 0, drain and fill carry an Undo on the note for 5 s. Ticket:
// docs/ticket-lot-lookout-too-slow-on-the-fly.md.
import { useEffect, useState } from 'react';
import { BAY_DIRTIES_MAX, clockOf, isBayStale } from '../../lib/lotBay';
import { hapticLight } from '../../lib/haptics';
import type { LotBayState } from '../../hooks/useLotBay';
import { useBayTapsSignedIn, type BayField } from '../../hooks/useBayTaps';
import { useLotCrew } from '../../hooks/useLotCrew';
import { useUndoNote } from '../../hooks/useUndoNote';

const STEP = 'w-14 h-14 shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-2xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer touch-manipulation active:scale-95 transition';
const SMALL = 'h-11 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-gray-100 cursor-pointer touch-manipulation active:scale-95 transition disabled:opacity-40 disabled:cursor-default';
const TONE = {
  cleans: { box: 'bg-green-50 dark:bg-green-900/20', label: 'text-green-800 dark:text-green-300', quick: 'text-green-700 dark:text-green-400' },
  dirties: { box: 'bg-red-50 dark:bg-red-900/20', label: 'text-red-800 dark:text-red-300', quick: 'text-red-700 dark:text-red-400' },
} as const;

function Quick({ n, word, sign, tone, onTap }: { n: number; word: string; sign: '−' | '+'; tone: string; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} disabled={n < 1} aria-label={n < 1 ? `${word}: no drivers on` : `${word} ${n}, one per driver on`}
      className={`${SMALL} min-w-[3.6rem] px-2 grid justify-items-center content-center leading-none gap-0.5`}>
      <span className={`font-mono text-base ${tone}`}>{sign}{n}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{word}</span>
    </button>
  );
}

function CountBlock({ field, value, at, nowMs, onStep, onSet, onZero, quick }: {
  field: BayField; value: number | null; at: string | null; nowMs: number;
  onStep: (d: 1 | -1) => void; onSet: (n: number) => Promise<boolean>; onZero: () => void; quick: React.ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [bad, setBad] = useState(false);
  const tone = TONE[field];
  const set = async () => {
    const t = typed.trim();
    if (!/^\d+$/.test(t) || Number(t) > BAY_DIRTIES_MAX) { setBad(true); return; }
    if (await onSet(Number(t))) setTyped('');
  };
  const zero = <button type="button" onClick={onZero} aria-label={`${field} to zero`} className={`${SMALL} w-11 font-mono`}>0</button>;
  return (
    <section aria-label={field === 'cleans' ? 'Cleans' : 'Dirties'} className={`rounded-2xl p-2.5 space-y-2 ${tone.box}`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => onStep(-1)} aria-label={`One fewer ${field === 'cleans' ? 'clean' : 'dirty'}`} className={STEP}>−</button>
        <div className="text-center min-w-0">
          <div className={`text-xs font-bold uppercase tracking-wide ${tone.label}`}>{field === 'cleans' ? 'Cleans' : 'Dirties'}</div>
          <div className="text-4xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100 leading-tight">{value ?? '–'}</div>
          <div className={`text-[11px] ${isBayStale(at, nowMs) ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {at ? `as of ${clockOf(at)}` : 'not counted yet'}
          </div>
        </div>
        <button type="button" onClick={() => onStep(1)} aria-label={`One more ${field === 'cleans' ? 'clean' : 'dirty'}`} className={STEP}>+</button>
      </div>
      <form onSubmit={e => { e.preventDefault(); void set(); }} className="flex gap-1.5">
        {field === 'cleans' ? quick : zero}
        <input id={`erin-${field}`} inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={`${field} on the lot`}
          value={typed} onChange={e => { setTyped(e.target.value); setBad(false); }}
          className={`w-full min-w-0 rounded-lg border bg-white dark:bg-gray-900 px-2 text-center font-mono text-lg font-bold text-gray-900 dark:text-gray-100 ${bad ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`} />
        <button type="submit" className={`${SMALL} px-3`}>Set</button>
        {field === 'cleans' ? zero : quick}
      </form>
      {bad && <p role="alert" className="text-[11px] font-semibold text-red-700 dark:text-red-400">Type a number from 0 to {BAY_DIRTIES_MAX}.</p>}
    </section>
  );
}

export function ErinCountSheet({ erin, by, onClose }: { erin: LotBayState; by: string; onClose: () => void }) {
  const [note, show, clearNote] = useUndoNote();
  const taps = useBayTapsSignedIn(erin, show, by);
  const { crew } = useLotCrew({ signedIn: true });
  const drivers = crew?.summary.driver.airport ?? 0;
  const bay = erin.bay;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!bay) return null;
  const copyText = `${bay.cleans}/${bay.dirties ?? '–'}`;
  const tap = (f: () => unknown) => () => { hapticLight(); void f(); };
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

        <CountBlock field="cleans" value={bay.cleans} at={bay.cleansAt} nowMs={erin.nowMs}
          onStep={d => { hapticLight(); void taps.tapCleans(d); }} onSet={n => taps.setCount('cleans', n)} onZero={tap(() => taps.setCount('cleans', 0))}
          quick={<Quick n={drivers} word="drain" sign="−" tone={TONE.cleans.quick} onTap={tap(() => taps.drain(drivers))} />} />
        <CountBlock field="dirties" value={bay.dirties} at={bay.dirtiesAt} nowMs={erin.nowMs}
          onStep={d => { hapticLight(); void taps.stepDirties(d); }} onSet={n => taps.setCount('dirties', n)} onZero={tap(() => taps.setCount('dirties', 0))}
          quick={<Quick n={drivers} word="fill" sign="+" tone={TONE.dirties.quick} onTap={tap(() => taps.fill(drivers))} />} />

        <button type="button" onClick={copy}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-bold text-black cursor-pointer">
          Copy <span className="font-mono">{copyText}</span>
        </button>

        <div role="status" aria-live="polite" className={`min-h-9 flex items-center justify-center gap-3 rounded-full px-4 py-2 text-sm font-semibold transition-opacity ${note ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 opacity-100' : 'opacity-0'}`}>
          <span>{note?.msg}</span>
          {note?.undo && (
            <button type="button" onClick={() => { const u = note.undo; clearNote(); u?.(); }} className="underline font-bold cursor-pointer">Undo</button>
          )}
        </div>
      </div>
    </div>
  );
}
