// /lot/view — Erin St, read only. No PIN, no buttons: for whoever just wants to know without texting the bay (Aaron,
// 2026-10-15: *"Without the constant message. "What's the count?/How many clean and dirty?""*).
//
// ⭐ The bay log (2026-10-29): *"someone with the read-only link can see which vehicle we're currently cleaning ... once
// done, goes on the cleaned list. boss could see what we've done so far and when it was done"*. The counter reads it
// for *"checking what's done"*. The airport is gone from here: *"strictly erin st"*.
//
// His rulings for this page stand: its own link, so nothing can be tapped by accident and it outlives a PIN change; and
// times, never initials. The bay log adds one more: durations, never (BayLogList shows exit times only). /lot opens
// here too, so a driver's saved airport link lands on something live.
//
// Today's crew (migration 154) shows as NUMBERS from GET /api/lot, which never sends this page a name.
//
// ⭐ NOT BEING KEPT (2026-11-05, docs/ticket-lot-view-count-not-kept.md): after 2 h with nothing done (his number, any
// tap), the page blurs behind a card in the BAY's voice, never his: no name, no hours, no "back at". Show it anyway
// clears it for the visit; his next tap clears it for everyone.
//
// ⭐ ON BREAK (migration 166, docs/ticket-lot-bay-on-break.md): a heads-up, not the blur: the count isn't stale, it's
// paused. No time on it: this link reaches his manager, and a start time would make it a log of his breaks.
//
// ⭐ DESKTOP (2026-11-19, docs/ticket-lot-view-desktop-layout.md): the counter reads this on a monitor, not a phone. Aaron:
// *"Jagdeep reads from the computer rather than from his phone. What say we have a desktop version with a better bougie
// view?"* From `lg` up: the bay and the count on the left, big and pinned; Find and the log on the right, a car a line.
// Below `lg` nothing moves: the two columns are just the phone's own order, split in two. Layout only, same data.
// Second mock (his: *"The left column feels bare with all that negative space especially the deeper the day goes"*):
// the left also takes "Today so far" as tiles (the list's chips, grown; they filter the same list), Find, and the
// crew line, so the list gets the right side alone. On a phone those stay where they always were (`lg:hidden` twins).
import { useState } from 'react';
import type { BayFilter } from '../../lib/bayListView';
import { useBayLog } from '../../hooks/useBayLog';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotCrew } from '../../hooks/useLotCrew';
import { isCountKept, isOnBreak, lastActivity, lastHand } from '../../lib/countKept';
import { whenOf } from '../../lib/lotBay';
import { inTheBay } from '../../lib/lotBayLog';
import { shiftDayLabel } from '../../lib/shiftDay';
import { BayFind } from './BayFind';
import { BayLogList } from './BayLogList';
import { LotBayStrip } from './LotBayStrip';
import { BayTodayTiles } from './BayTodayTiles';
import { LotCrewLine } from './LotCrewLine';

// One column on a phone; from `lg`, a fixed glance column beside the log.
const COLUMNS = 'space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-8 lg:items-start';

export function LotViewPage() {
  const erin = useLotBay();
  const bay = useBayLog();
  const { crew } = useLotCrew();
  const open = inTheBay(bay.rows);
  const [shown, setShown] = useState(false);
  // One filter for the tiles (desktop) and the chips (phone): both drive the same list.
  const [filter, setFilter] = useState<BayFilter | null>(null);
  const last = lastActivity(erin.bay, bay.rows);
  const breakAt = erin.bay?.breakAt;
  const hand = lastHand(last, breakAt);
  const covered = erin.loaded && bay.loaded && !shown && !isCountKept(hand, erin.nowMs);
  const onBreak = !covered && isCountKept(hand, erin.nowMs) && isOnBreak(breakAt, last);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] lg:max-w-6xl px-4 lg:px-8 pt-3 lg:pt-6 pb-10 space-y-3 lg:space-y-5">
        {/* The FG brand (2026-11-15, docs/ticket-lot-view-fg-branding.md). Aaron: *"its quiet advertising of the FG brand
            we've built"*. Lot Lookout stays the headline, since it's what the link is opened for; the logo and the line
            under it say where it comes from. The app header's logo, without its online dot: that dot is HIS
            connection, and means nothing to a viewer. */}
        <div className="flex items-center gap-2.5">
          <img src="/FG.webp" alt="Fleet Garage" className="w-9 h-9 shrink-0 rounded-md object-cover" />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">Lot Lookout</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fleet Garage · Erin St · read only</p>
          </div>
        </div>
        {!erin.loaded || !bay.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the bay…</p> : (
          <div className="relative">
          {covered && (
            <section aria-label="Not being kept" className="absolute inset-x-0 top-6 z-10 mx-2 lg:mx-auto lg:max-w-md rounded-2xl border border-gray-300 dark:border-gray-600 bg-white/95 dark:bg-gray-900/95 px-4 py-4 text-center shadow-lg">
              <p className="font-bold">The count isn't being kept right now.</p>
              {last && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Last updated {whenOf(last, erin.nowMs)}.</p>}
              <button type="button" onClick={() => setShown(true)}
                className="mt-3 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                Show it anyway
              </button>
            </section>
          )}
          <div className={`${COLUMNS} ${covered ? 'blur-sm pointer-events-none select-none' : ''}`} aria-hidden={covered || undefined}>
            <div data-column="glance" className="space-y-3 lg:space-y-5 lg:sticky lg:top-6">
            {onBreak && (
              <p role="status" className="rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 px-4 py-2.5 text-sm text-sky-900 dark:text-sky-100">
                {/* Pulled away (migration 171): generic, never what the work was; no time on either. */}
                <span className="font-bold">{erin.bay?.breakKind === 'pulled'
                  ? 'The count is paused while the bay crew is on other work.'
                  : 'The count is paused for a break.'}</span> It catches up after.
              </p>
            )}
            <section aria-label="In the bay now"
              className={`rounded-2xl px-4 py-3 lg:px-6 lg:py-5 ${open ? 'border-2 border-amber-500 bg-white dark:bg-gray-900' : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
              <p className="text-[11px] lg:text-sm font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">In the bay now</p>
              {open ? (
                <>
                  <p className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg lg:text-5xl font-bold">{open.plate}</span>
                    <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">since {whenOf(open.started_at, erin.nowMs)}</span>
                  </p>
                  {open.car && <p className="text-sm lg:text-lg lg:mt-1 text-gray-600 dark:text-gray-300">{open.car}</p>}
                </>
              ) : <p className="mt-1 text-sm lg:text-lg text-gray-600 dark:text-gray-300">Nothing in the bay right now.</p>}
            </section>
            {erin.bay ? <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} big />
              : <p className="text-sm text-red-700 dark:text-red-400">Erin St's count could not load.</p>}
            <div data-desktop-only className="hidden lg:block space-y-5">
              <BayTodayTiles rows={bay.rows} filter={filter} onFilter={setFilter} />
              <BayFind readOnly />
              {crew && <LotCrewLine summary={crew.summary} big />}
            </div>
            </div>
            <div data-column="log" className="space-y-3">
            {bay.error && <p className="text-sm text-red-700 dark:text-red-400">{bay.error}</p>}
            {/* Find a car (2026-11-10): the last 14 days here, his ruling. docs/ticket-bay-log-find-a-car.md */}
            <div data-phone-only className="lg:hidden"><BayFind readOnly /></div>
            <BayLogList rows={bay.rows} readOnly heading={`Today · ${shiftDayLabel()}`}
              filter={filter} onFilter={setFilter} chipsClassName="lg:hidden" />
            {/* What a ✈ mark means (2026-11-17, docs/ticket-lot-view-sent-mark-disclaimer.md): a receipt for the cars asked
                for by name, not a record of every car that left. Aaron: *"the count is more important than what was
                marked as sent"*. On a busy stretch the marks can't keep up, and FG never guesses which cars went. */}
            <p className="text-xs text-gray-500 dark:text-gray-400">✈ marks cars asked for by name. The count is the lot.</p>
            {crew && <div data-phone-only className="lg:hidden"><LotCrewLine summary={crew.summary} /></div>}
            </div>
          </div>
          </div>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Updates by itself. Cars and times from the bay log.</p>
      </div>
    </div>
  );
}
