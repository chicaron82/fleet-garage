// FG's side of Lot Lookout: the airport stall board, live, on My Day. Aaron, 2026-10-14: *"i'll share it with a
// morning driver to see if they're interested. then i can see it in FG."* Drivers tap at /lot; this card reads
// the same rows (useLotBoard) and never writes. It answers the question from Erin St — is the airport really
// low? — in one line, and opens to the map.
//
// Hidden until the board exists (migration 151) so a missing table never shows an error on his landing screen.
import { useMemo, useState } from 'react';
import { lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { LotSummary } from '../lot/LotSummary';
import { LotMap } from '../lot/LotMap';

export function LotLookoutCard({ cardClass }: { cardClass: string }) {
  const board = useLotBoard();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);
  if (!board.loaded || board.error || board.stalls.length === 0) return null;

  const link = `${window.location.origin}/lot`;
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    <section className={`${cardClass} px-4 py-3.5 space-y-3`} aria-label="Airport lot">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Airport lot · live</span>
          <span className={`block text-sm font-semibold ${totals.low ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {totals.low ? `Low on cleans: ${totals.cleansSeen} seen` : `Not low: ${totals.cleansSeen} cleans seen`}
          </span>
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{open ? 'Hide map ▴' : 'See the lot ▾'}</span>
      </button>

      <LotSummary totals={totals} aisleCars={board.aisle.cars} showLegend={open} />

      {open && (
        <>
          <LotMap stalls={board.stalls} aisle={board.aisle} nowMs={board.nowMs} nPulse={totals.nPulse} />
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="min-w-0 break-all">Driver link: <span className="font-mono text-gray-700 dark:text-gray-300">{link}</span></span>
            <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
