// /lot/erin — Erin St's count, tapped in the bay. Cleans ready for the airport: +1 when one is parked ready, −1
// when one is used (the airport, or poached by Erin St or Regent). Dirties waiting: typed now and then.
// Same PIN and initials as /lot. (Ticket: docs/ticket-erin-st-cleans-ready-count.md; rules in src/lib/lotBay.ts.)
import { useState } from 'react';
import { BAY_DIRTIES_MAX as DIRTIES_MAX, bayTapLine, clockOf, isBayStale, usedToday } from '../../lib/lotBay';
import { agoLabel, minutesAgo } from '../../lib/lotLookout';
import { useLotBay } from '../../hooks/useLotBay';
import { useBayTaps } from '../../hooks/useBayTaps';
import { useLotToast } from '../../hooks/useLotToast';
import { LotPinGate, LotTapperBar, LotToast } from './LotChrome';

const tile = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3.5 space-y-2.5';
const label = 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const amberNote = 'rounded-lg bg-amber-100 dark:bg-amber-950/70 px-2.5 py-2 text-[13px] font-semibold text-amber-800 dark:text-amber-300';

function AsOf({ at, by, nowMs }: { at: string | null; by?: string | null; nowMs: number }) {
  if (!at) return <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">not counted yet</span>;
  const old = isBayStale(at, nowMs);
  return (
    <span className={`text-xs text-right ${old ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
      as of <strong className={old ? '' : 'text-gray-900 dark:text-gray-100'}>{clockOf(at)}</strong>{by ? ` · ${by}` : ''}
      <br />{agoLabel(minutesAgo(at, nowMs))}
    </span>
  );
}

export function LotBayPage() {
  const erin = useLotBay({ withLog: true });
  const [toastMsg, toast] = useLotToast();
  const taps = useBayTaps(erin, toast);
  const [typed, setTyped] = useState('');
  const { bay, nowMs } = erin;

  const saveDirties = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(typed.trim());
    if (!/^\d+$/.test(typed.trim()) || n > DIRTIES_MAX) { toast(`Type a number from 0 to ${DIRTIES_MAX}`); return; }
    if (await taps.setDirties(n)) setTyped('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pb-24">
        {!taps.pin ? <LotPinGate onUnlock={taps.unlock} blurb="Erin St's count of cleans and dirties." /> : (
          <div className="pt-3 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="text-xl font-extrabold">Lot Lookout</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400">Erin St · washbay</span>
            </div>
            {!erin.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the count…</p>
              : !bay ? <p className="mt-8 text-center text-sm text-red-700 dark:text-red-400">The count could not load. Check the signal and try again.</p> : (
              <>
                <section className={tile} aria-label="Cleans ready for the airport">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={label}>Cleans ready for the airport</span>
                      <b className={`block text-6xl font-extrabold leading-none tabular-nums mt-1 ${isBayStale(bay.cleansAt, nowMs) ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{bay.cleans}</b>
                    </div>
                    <AsOf at={bay.cleansAt} by={bay.cleansBy} nowMs={nowMs} />
                  </div>
                  {bay.cleansAt && isBayStale(bay.cleansAt, nowMs) && (
                    <p className={amberNote}>Nothing tapped in 30 min. Either none are ready, or the drivers are stuck at the airport.</p>
                  )}
                  <div className="grid grid-cols-[1fr_1.6fr] gap-2">
                    <button type="button" onClick={() => void taps.tapCleans(-1)}
                      className="rounded-2xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-4 text-lg font-extrabold cursor-pointer touch-manipulation">
                      −1<span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">used</span>
                    </button>
                    <button type="button" onClick={() => void taps.tapCleans(1)}
                      className="rounded-2xl border-2 border-green-700 bg-green-700 py-4 text-lg font-extrabold text-white cursor-pointer touch-manipulation">
                      +1<span className="block text-[11px] font-semibold opacity-90">parked, ready to go</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-gray-100">{usedToday(bay, nowMs)}</strong> used today</p>
                </section>

                <section className={tile} aria-label="Dirties waiting">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={label}>Dirties waiting</span>
                      <b className={`block text-6xl font-extrabold leading-none tabular-nums mt-1 ${isBayStale(bay.dirtiesAt, nowMs) ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>{bay.dirties ?? '–'}</b>
                    </div>
                    <AsOf at={bay.dirtiesAt} by={bay.dirtiesBy} nowMs={nowMs} />
                  </div>
                  {bay.dirtiesAt && isBayStale(bay.dirtiesAt, nowMs) && <p className={amberNote}>Over 30 min old. Update it when you get a second.</p>}
                  <form onSubmit={e => void saveDirties(e)} className="flex gap-2">
                    <input id="bay-dirties" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="New count" aria-label="New dirty count"
                      value={typed} onChange={e => setTyped(e.target.value)}
                      className="w-full min-w-0 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-center font-mono text-xl font-bold" />
                    <button type="submit" className="rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi px-5 font-semibold text-black cursor-pointer whitespace-nowrap">Update</button>
                  </form>
                </section>

                <section className={tile} aria-label="Today">
                  <span className={label}>Today</span>
                  {erin.log.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No changes yet this shift.</p> : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      {erin.log.map(t => (
                        <li key={t.id} className="grid grid-cols-[3.25rem_1fr_auto] gap-2 py-1.5">
                          <span className="tabular-nums text-gray-500 dark:text-gray-400">{clockOf(t.at)}</span>
                          <span>{bayTapLine(t)}</span>
                          <span className="font-mono font-bold text-gray-500 dark:text-gray-400">{t.by}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </div>

      {taps.pin && <LotTapperBar by={taps.by} setBy={taps.setBy} hint="+1 parked, −1 used" />}
      <LotToast msg={toastMsg} />
    </div>
  );
}
