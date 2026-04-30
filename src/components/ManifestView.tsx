import { useMemo, useRef, useEffect } from 'react';
import {
  generateDayManifest, getNextFiveNeeded,
  getCurrentSeason, SEASON_PRIORITY,
  type ManifestReservation, type RentalClass,
} from '../data/manifest';

// ── Season display config ─────────────────────────────────────────────────────

const SEASON_CONFIG = {
  summer:   { label: 'Summer Priority',  badge: '☀️' },
  shoulder: { label: 'Shoulder Season',  badge: '🍂' },
  winter:   { label: 'Winter Priority',  badge: '🧊' },
};

// ── Class pill priority colouring ─────────────────────────────────────────────

function getClassPillStyle(cls: RentalClass, priorityList: RentalClass[]): string {
  const rank = priorityList.indexOf(cls);
  if (rank < 0)  return 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500';
  if (rank <= 2) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
  if (rank <= 6) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
  return 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-500';
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function isPast(time: string, now: Date): boolean {
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return time < current;
}

function isCurrentWindow(time: string, now: Date): boolean {
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return time >= current && time <= current.replace(/:\d\d$/, ':59');
}

// ── Row component ─────────────────────────────────────────────────────────────

function ReservationRow({
  reservation, priority, highlight, past,
}: {
  reservation: ManifestReservation;
  priority: RentalClass[];
  highlight: boolean;
  past: boolean;
}) {
  const pillStyle = getClassPillStyle(reservation.rentalClass, priority);

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      highlight
        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        : past
        ? 'opacity-40'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
    }`}>
      {/* Time */}
      <span className={`text-xs font-mono w-10 shrink-0 ${
        highlight ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {reservation.time}
      </span>

      {/* Class pill */}
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${pillStyle}`}>
        {reservation.rentalClass}
      </span>

      {/* Customer */}
      <span className={`text-xs flex-1 truncate ${
        highlight ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'
      }`}>
        {reservation.customerName}
      </span>

      {/* Duration */}
      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
        {reservation.duration}
      </span>

      {/* Pickup type */}
      <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded ${
        reservation.pickupType === 'express'
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      }`}>
        {reservation.pickupType === 'express' ? 'Express' : 'Counter'}
      </span>

      {/* Past check */}
      {past && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">✓</span>}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ManifestView() {
  const now     = useMemo(() => new Date(), []);
  const today   = useMemo(() => generateDayManifest(now), [now]);
  const season  = useMemo(() => getCurrentSeason(), []);
  const priority = SEASON_PRIORITY[season];
  const nextFive = useMemo(() => getNextFiveNeeded(today, now), [today, now]);
  const nextFiveIds = useMemo(() => new Set(nextFive.map(r => r.id)), [nextFive]);
  const nowLineRef = useRef<HTMLDivElement>(null);

  // Scroll "now" line into view on mount
  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const seasonCfg = SEASON_CONFIG[season];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            📋 Today's Manifest
          </h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            {seasonCfg.label} {seasonCfg.badge}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDate(now)} · {today.length} reservations
        </p>
      </div>

      {/* Next 5 Needed */}
      {nextFive.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Next 5 Needed
          </p>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
            {nextFive.map(r => (
              <div key={r.id} className="border-b border-amber-100 dark:border-amber-900/40 last:border-0">
                <ReservationRow
                  reservation={r}
                  priority={priority}
                  highlight
                  past={false}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {nextFive.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No more reservations today.</p>
        </div>
      )}

      {/* Full Day */}
      <section className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Full Day
        </p>
        <div className="space-y-0.5">
          {today.map((r, i) => {
            const past = isPast(r.time, now);
            const current = isCurrentWindow(r.time, now);

            return (
              <div key={r.id}>
                {/* "Now" indicator line */}
                {current && (
                  <div ref={nowLineRef} className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                    <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 shrink-0">NOW</span>
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                  </div>
                )}
                {/* Insert now line between past and future if no exact match */}
                {!current && i > 0 && isPast(today[i - 1].time, now) && !past && !nowLineRef.current && (
                  <div ref={nowLineRef} className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                    <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 shrink-0">NOW</span>
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                  </div>
                )}
                <ReservationRow
                  reservation={r}
                  priority={priority}
                  highlight={nextFiveIds.has(r.id)}
                  past={past}
                />
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
