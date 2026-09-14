import { useState, useRef } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { getWeekBounds, toISO } from '../../lib/schedule-helpers';
import { useAuth } from '../../context/AuthContext';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { ShiftForm } from './ShiftForm';
import { FlipShiftSheet } from './FlipShiftSheet';
import { calcOT, calcHours, netActualHours, fmtHours } from '../../lib/ot';
import { fmtOverlap } from '../../lib/shiftOverlap';
import { resolveWeekSwipe } from '../../lib/weekSwipe';
import { isFullDayShift, canManageSchedule } from '../../types';
import type { ShiftType, ShiftWithUser } from '../../types';
import { SHIFT_TYPE_PILL } from '../../lib/shiftTypeMeta';
import { orderRoster, driverBlockUnloaded, isSeamRow } from '../../lib/rosterOrder';

// The grid's compact ALL-CAPS badges are this view's own dialect (not the shared
// short labels), and the 12h '4:00p' time is deliberately compact for cell width.
const FULL_DAY_LABEL: Partial<Record<ShiftType, string>> = {
  'day-off': 'OFF',
  'pto':     'PTO',
  'sick':    'SICK',
};

function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m}${hr >= 12 ? 'p' : 'a'}`;
}

interface Props { today: string; visibleUserIds: Set<string>; overlaps?: ReadonlyMap<string, number>; }

// ⭐⭐ THE GRID KEEPS ITS EDGES IN VIEW (Aaron, 2026-09-14, on his phone scrolled to the counter block):
// *"is there a way to make the date row sticky so it shows the date even when scrolling further down?"*
//
// ⚠️ A BARE `sticky top-0` WOULD DO NOTHING HERE. The wrapper is `overflow-x-auto`, and `position:
// sticky` sticks to the nearest scroll container — which only ever scrolled sideways while the PAGE
// scrolled down. So the grid is now its own bounded scroll box in both axes: the date row sticks to
// its top, and the Staff column to its left (scrolling right to Fri–Sun used to lose the names the
// same way scrolling down lost the dates). Rejected: a separate page-sticky date strip mirroring
// `scrollLeft` — two things to keep aligned, and no sensible sticky names column.
//
// ⚠️ STICKY CELLS MUST BE OPAQUE, or the shifts sliding underneath show through. The row tints are
// translucent, so each sticky cell paints the SAME tint composited over the base with color-mix —
// the seam row and the "you" row look identical whether a cell is stuck or not.
const ROW_TINT = {
  me:    'bg-yellow-50/50 dark:bg-yellow-900/5',
  seam:  'bg-slate-200/70 dark:bg-slate-700/40',
  plain: '',
};
const STICKY_TINT = {
  me:    'bg-[color-mix(in_oklab,var(--color-yellow-50)_50%,var(--color-white))] dark:bg-[color-mix(in_oklab,var(--color-yellow-900)_5%,var(--color-gray-900))]',
  seam:  'bg-[color-mix(in_oklab,var(--color-slate-200)_70%,var(--color-white))] dark:bg-[color-mix(in_oklab,var(--color-slate-700)_40%,var(--color-gray-900))]',
  plain: 'bg-white dark:bg-gray-900',
};
/** A hairline on the stuck edge — table borders do not travel with a sticky cell under border-collapse. */
const STICKY_RIGHT_EDGE  = 'shadow-[inset_-1px_0_0_var(--color-gray-100)] dark:shadow-[inset_-1px_0_0_var(--color-gray-800)]';
const STICKY_BOTTOM_EDGE = 'shadow-[inset_0_-1px_0_var(--color-gray-100)] dark:shadow-[inset_0_-1px_0_var(--color-gray-800)]';

export function WeekView({ today, visibleUserIds, overlaps }: Props) {
  const { shifts, currentDate, canEditShift, loading, goToPrev, goToNext } = useSchedule();
  const { user } = useAuth();
  const teamMembers = useTeamMembers();
  const [editShift, setEditShift]     = useState<ShiftWithUser | null>(null);
  const [flipShift, setFlipShift]     = useState<ShiftWithUser | null>(null);
  const [addFor, setAddFor]           = useState<{ date: string; userId: string } | null>(null);
  const canSchedule = user ? canManageSchedule(user.role) : false;
  const touchStartX    = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  // ⚠️ The grid's scroll position when the finger LANDED — the edge must be judged before the gesture
  // moves the grid, or the swipe that reveals Monday also jumps a week (lib/weekSwipe, 2026-09-14).
  const touchStartScroll = useRef<{ scrollLeft: number; scrollWidth: number; clientWidth: number } | null>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current    = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    const el = scrollRef.current;
    touchStartScroll.current = el ? { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartTime.current === null) return;
    const deltaX  = touchStartX.current - e.changedTouches[0].clientX;
    const elapsed = Date.now() - touchStartTime.current;
    touchStartX.current    = null;
    touchStartTime.current = null;
    // Must be a quick flick (< 250ms); distance + scroll-edge gating lives in
    // resolveWeekSwipe so a mid-week swipe scrolls toward Sunday instead of
    // yanking to the next week before it's been seen.
    if (elapsed > 250) return;
    const start = touchStartScroll.current;
    touchStartScroll.current = null;
    const el = scrollRef.current;
    const nav = start
      ? resolveWeekSwipe(deltaX, start, { endScrollLeft: el?.scrollLeft ?? start.scrollLeft })
      : resolveWeekSwipe(deltaX, el ?? { scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
    if (nav === 'next')      goToNext();
    else if (nav === 'prev') goToPrev();
  };

  // Build 7 days of this week (Mon–Sun)
  const { start } = getWeekBounds(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  // Build shift lookup: `${userId}-${date}` → shift
  const shiftMap = new Map<string, ShiftWithUser>();
  for (const s of shifts) shiftMap.set(`${s.userId}-${s.date}`, s);

  // ⭐⭐ Self pinned first, then FLOOR → DRIVERS → COUNTER (reordered 2026-09-14), alphabetical inside each. Until
  //    2026-09-06 the rest were listed in `useTeamMembers` order, which is Supabase's return order —
  //    so two VSAs sat below thirteen empty driver rows and a two-person closing shift read as one
  //    person alone. See `lib/rosterOrder.ts`.
  const visibleUsers = orderRoster(
    teamMembers.filter(u => visibleUserIds.has(u.id)),
    user?.id,
  );

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ⭐⭐⭐ A BLANK DRIVER BLOCK IS THE NORMAL STATE, NOT A GAP — and it read as "nobody scheduled".
  //
  // Aaron, 2026-09-06: *"the driver's get there's weekly. and i won't see it until i go to work on
  // tuesday."* The VSAs come as a four-week block; the drivers come a week at a time and reach him
  // at the branch. So **every forward week has an empty driver block by design**, and it will look
  // exactly like this every Sunday night he opens the app.
  //
  // ⚠️ FG already has the rule this breaks, written down for attendance: **unmarked ≠ absent** — an
  // unobserved person is not a no-show. The same blankness here reads as "not working", when what it
  // means is "not posted yet". A row that says nothing is not saying nothing; it is saying the
  // wrong thing, and it is the same blankness that buried two VSAs an hour ago.
  const driversUnloaded = driverBlockUnloaded(
    visibleUsers, u => days.some(d => shiftMap.has(`${u.id}-${toISO(d)}`)),
  );

  return (
    <>
      <div
        ref={scrollRef}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-auto max-h-[80dvh] overscroll-contain transition-colors"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading && (
          <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">Loading…</div>
        )}
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr>
              {/* The corner sits above BOTH sticky edges. */}
              <th className={`sticky top-0 left-0 z-30 text-left py-2.5 px-3 text-gray-400 dark:text-gray-500 font-semibold w-20 ${STICKY_TINT.plain} shadow-[inset_-1px_-1px_0_var(--color-gray-100)] dark:shadow-[inset_-1px_-1px_0_var(--color-gray-800)]`}>Staff</th>
              {days.map((d, i) => {
                const iso = toISO(d);
                const isToday = iso === today;
                return (
                  <th key={i} className={`sticky top-0 z-20 text-center py-2.5 px-1 font-semibold ${STICKY_TINT.plain} ${STICKY_BOTTOM_EDGE} ${
                    isToday ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <div>{DAY_NAMES[i]}</div>
                    <div className="font-normal text-gray-400 dark:text-gray-600">{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map(u => {
              const isMe = u.id === user?.id;
              const tint = isMe ? 'me' : isSeamRow(u) ? 'seam' : 'plain';
              return (
                <tr
                  key={u.id}
                  className={`border-t border-gray-100 dark:border-gray-800 ${ROW_TINT[tint]}`}
                >
                  <td className={`sticky left-0 z-10 py-2 px-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap ${STICKY_TINT[tint]} ${STICKY_RIGHT_EDGE}`}>
                    <div>{u.name.split(' ')[0]}</div>
                    <div className="text-gray-400 dark:text-gray-600 font-normal">{u.role.replace('Operations Manager', 'Ops Mgr').replace('Branch Manager', 'Br. Mgr')}</div>
                    {u.utility && (
                      <div className="mt-0.5 inline-block rounded bg-slate-200 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">🔧 Utility</div>
                    )}
                    {!isMe && overlaps?.get(u.id) != null && (
                      <div className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">{fmtOverlap(overlaps.get(u.id)!)} w/ you</div>
                    )}
                  </td>
                  {days.map((d, i) => {
                    const iso = toISO(d);
                    const shift = shiftMap.get(`${u.id}-${iso}`);
                    const isToday = iso === today;
                    const canEdit = shift ? canEditShift(shift) : isMe;

                    return (
                      <td key={i} className={`text-center px-1 py-2 ${isToday ? 'bg-yellow-50/30 dark:bg-yellow-900/5' : ''}`}>
                        {shift ? (
                          <button
                            onClick={() => {
                              if (isMe) setFlipShift(shift);
                              else if (canEdit) setEditShift(shift);
                            }}
                            className={`w-full px-1 py-1 rounded-md text-xs font-medium transition ${
                              shift.shiftType === 'pto' && !shift.ptoApproved
                                ? 'border border-dashed border-violet-400 text-violet-600 dark:text-violet-400'
                                : SHIFT_TYPE_PILL[shift.shiftType]
                            } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {isFullDayShift(shift.shiftType) ? (
                              <>
                                {calcOT(shift) > 0 ? (
                                  <>{fmtTime(shift.actualStartTime)}<br />{fmtTime(shift.actualEndTime)}</>
                                ) : (
                                  FULL_DAY_LABEL[shift.shiftType]
                                )}
                                {shift.shiftType === 'pto' && !shift.ptoApproved && <span className="block text-violet-400 text-[9px] leading-tight">pending</span>}
                                {shift.isStat && <span className="block text-amber-500 text-[10px] leading-tight">★</span>}
                                {calcOT(shift) > 0 && (
                                  <span className="block text-amber-600 dark:text-amber-400 font-semibold text-[10px] leading-tight">
                                    +{fmtHours(calcOT(shift))} OT
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {fmtTime(shift.startTime)}<br />{fmtTime(shift.endTime)}
                                {shift.isStat && <span className="block text-amber-500 text-[10px] leading-tight mt-0.5">★ stat</span>}
                                {calcOT(shift) > 0 && (
                                  <span className="block text-amber-600 dark:text-amber-400 font-semibold text-[10px] leading-tight">
                                    +{fmtHours(calcOT(shift))} OT
                                  </span>
                                )}
                                {calcOT(shift) === 0 && shift.actualStartTime && shift.actualEndTime && (
                                  <span className="block text-gray-500 dark:text-gray-400 text-[10px] leading-tight">
                                    {fmtHours(netActualHours(calcHours(shift.actualStartTime, shift.actualEndTime)))}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        ) : (isMe || canSchedule) ? (
                          <button
                            onClick={() => setAddFor({ date: iso, userId: u.id })}
                            className="w-full py-1 text-gray-300 dark:text-gray-600 hover:text-yellow-500 dark:hover:text-yellow-400 text-base font-light transition cursor-pointer"
                            aria-label={`Add shift ${DAY_NAMES[i]}`}
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-gray-200 dark:text-gray-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {driversUnloaded && (
        <p className="px-1 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold">No driver shifts loaded for this week.</span>{' '}
          The driver schedule is posted weekly at the branch — blank here means FG has not been given
          it yet, not that nobody is on.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs px-1">
        {(['opening', 'mid', 'closing', 'day-off', 'pto', 'sick'] as ShiftType[]).map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${SHIFT_TYPE_PILL[t].split(' ')[0]}`} />
            <span className="text-gray-500 dark:text-gray-400 capitalize">
              {t === 'day-off' ? 'Day off' : t === 'pto' ? 'PTO' : t === 'sick' ? 'Sick' : t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-dashed border-violet-400" />
          <span className="text-gray-500 dark:text-gray-400">PTO pending</span>
        </div>
      </div>

      {/* Modals */}
      {editShift && (
        <ShiftForm
          mode="edit"
          initial={editShift}
          onClose={() => setEditShift(null)}
        />
      )}
      {flipShift && (
        <FlipShiftSheet
          shift={flipShift}
          onClose={() => setFlipShift(null)}
        />
      )}
      {addFor && (
        <ShiftForm
          mode="add"
          initialDate={addFor.date}
          initialUserId={addFor.userId}
          visibleUserIds={visibleUserIds}
          onClose={() => setAddFor(null)}
        />
      )}
    </>
  );
}
