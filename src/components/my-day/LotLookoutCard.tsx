// FG's side of Lot Lookout: the airport stall board, live, on My Day. Aaron, 2026-10-14: *"i'll share it with a
// morning driver to see if they're interested. then i can see it in FG."* Drivers tap at /lot; this card reads
// the same rows (useLotBoard) and never writes. It answers the question from Erin St — is the airport really
// low? — in one line, and opens to the map.
//
// Hidden until the board exists (migration 151) so a missing table never shows an error on his landing screen.
//
// Erin St's count sits on the card too, always open (Aaron, 2026-10-15: *"Is there a link to view my Erin St view
// within FG?"*): his count and its "as of" on his home screen, one tap from the page where he taps it. And it takes
// the taps right here (*"May I suggest adding the cleans steppers here and tap to update the dirties? Then keep the
// ability to open the full detail view"*): signed in to FG, no PIN — api/lot.ts takes the session instead.
// Today's crew sits under it (migration 154): numbers always, and "Who is where" opens the named list he taps.
import { useMemo, useState } from 'react';
import { initialsOf, lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { useLotBay } from '../../hooks/useLotBay';
import { useBayTapsSignedIn } from '../../hooks/useBayTaps';
import { useLotToast } from '../../hooks/useLotToast';
import { useAuth } from '../../context/AuthContext';
import { useLotCrew } from '../../hooks/useLotCrew';
import { LotCrewLine } from '../lot/LotCrewLine';
import { LotCrewPanel } from './LotCrewPanel';
import { LotSummary } from '../lot/LotSummary';
import { LotMap } from '../lot/LotMap';
import { LotBayStrip } from '../lot/LotBayStrip';

// The three ways in. Erin St's count and the read-only view arrived 2026-10-15 (migration 153); the view needs no PIN.
const LINKS = [
  { path: '/lot', label: 'Driver link' },
  { path: '/lot/erin', label: 'Erin St count' },
  { path: '/lot/view', label: 'Read only, no PIN' },
] as const;

export function LotLookoutCard({ cardClass }: { cardClass: string }) {
  const board = useLotBoard();
  const erin = useLotBay();
  const { user } = useAuth();
  const [note, toast] = useLotToast();
  const by = initialsOf(user?.name ?? null);
  const bayTaps = useBayTapsSignedIn(erin, toast, by);
  const { crew, mark } = useLotCrew({ signedIn: true });
  const [crewOpen, setCrewOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);
  if (!board.loaded || board.error || board.stalls.length === 0) return null;

  const copy = (link: string) => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(link); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  return (
    <section className={`${cardClass} px-4 py-3.5 space-y-3`} aria-label="Lot Lookout">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Lot Lookout · live</span>
          <span className={`block text-sm font-semibold ${totals.low ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {totals.low ? `Airport low on cleans: ${totals.cleansSeen} seen` : `Airport not low: ${totals.cleansSeen} cleans seen`}
          </span>
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{open ? 'Hide map ▴' : 'See the lot ▾'}</span>
      </button>

      {erin.bay && (
        <LotBayStrip bay={erin.bay} nowMs={erin.nowMs}
          controls={{ onCleans: d => void bayTaps.tapCleans(d), onDirties: bayTaps.setDirties }}
          action={<a href="/lot/erin" className="text-xs font-semibold text-gray-700 dark:text-gray-200 underline underline-offset-2">Full count ›</a>} />
      )}
      {note && <p role="status" className="-mt-1 px-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{note}</p>}

      {crew && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Crew now</h2>
            {crew.members && crew.members.length > 0 && (
              <button type="button" onClick={() => setCrewOpen(o => !o)} aria-expanded={crewOpen}
                className="text-xs font-semibold text-gray-700 dark:text-gray-200 underline underline-offset-2 cursor-pointer">
                {crewOpen ? 'Done ▴' : 'Who is where ▾'}
              </button>
            )}
          </div>
          <LotCrewLine summary={crew.summary} changedAt={crew.changedAt} heading={false} />
          {crewOpen && crew.members && <LotCrewPanel members={crew.members} mark={(u, st) => mark(u, st, by || 'FG')} toast={toast} />}
        </div>
      )}

      <LotSummary totals={totals} aisleCars={board.aisle.cars} showLegend={open} />

      {open && (
        <>
          <LotMap stalls={board.stalls} aisle={board.aisle} nowMs={board.nowMs} nPulse={totals.nPulse} />
          {LINKS.map(({ path, label }) => {
            const link = `${window.location.origin}${path}`;
            return (
              <div key={path} className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="min-w-0 break-all">{label}: <span className="font-mono text-gray-700 dark:text-gray-300">{link}</span></span>
                <span className="shrink-0 flex gap-1.5">
                  <a href={path} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-200">Open</a>
                  <button type="button" onClick={() => copy(link)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                    {copied === link ? 'Copied' : 'Copy'}
                  </button>
                </span>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
