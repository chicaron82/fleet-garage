import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  generateDayManifest, getNextFiveNeeded,
  getCurrentSeason, SEASON_PRIORITY,
  type ManifestReservation, type RentalClass,
} from '../data/manifest';
import { canFlagReservation, loadFlags, saveFlag, removeFlag } from '../lib/manifestFlags';
import {
  canSetOverride, loadOverrides, toggleOverride, clearAllOverrides,
  ALL_RENTAL_CLASSES, CLASS_LABELS,
} from '../lib/classOverrides';

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
  reservation, priority, highlight, past, flagged, canFlag, onToggleFlag,
}: {
  reservation: ManifestReservation;
  priority: RentalClass[];
  highlight: boolean;
  past: boolean;
  flagged: boolean;
  canFlag: boolean;
  onToggleFlag: () => void;
}) {
  const pillStyle = flagged
    ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
    : getClassPillStyle(reservation.rentalClass, priority);

  return (
    <div className={[
      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
      flagged
        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        : highlight
        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      past ? 'opacity-40' : '',
    ].join(' ')}>

      {flagged && <span className="text-xs shrink-0">🚨</span>}

      {/* Time */}
      <span className={`text-xs font-mono w-10 shrink-0 ${
        flagged   ? 'text-red-700 dark:text-red-400 font-semibold' :
        highlight ? 'text-amber-700 dark:text-amber-400 font-semibold' :
        'text-gray-500 dark:text-gray-400'
      }`}>
        {reservation.time}
      </span>

      {/* Class pill */}
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${pillStyle}`}>
        {reservation.rentalClass}
      </span>

      {/* Customer */}
      <span className={`text-xs flex-1 truncate ${
        flagged   ? 'text-gray-900 dark:text-gray-100 font-semibold' :
        highlight ? 'text-gray-900 dark:text-gray-100 font-medium' :
        'text-gray-600 dark:text-gray-400'
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

      {/* Past check or flag toggle */}
      {canFlag && !past ? (
        <button
          type="button"
          onClick={onToggleFlag}
          className={`text-xs shrink-0 px-1 transition cursor-pointer ${
            flagged
              ? 'text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200'
              : 'text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500'
          }`}
          title={flagged ? 'Remove priority flag' : 'Flag as priority'}
        >
          🚩
        </button>
      ) : past && !flagged ? (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">✓</span>
      ) : null}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ManifestView() {
  const { user } = useAuth();
  const now      = useMemo(() => new Date(), []);
  const today    = useMemo(() => generateDayManifest(now), [now]);
  const season   = useMemo(() => getCurrentSeason(), []);
  const priority = SEASON_PRIORITY[season];
  const nextFive = useMemo(() => getNextFiveNeeded(today, now), [today, now]);
  const nextFiveIds = useMemo(() => new Set(nextFive.map(r => r.id)), [nextFive]);
  const nowLineRef = useRef<HTMLDivElement>(null);

  const [flags, setFlags]       = useState<Set<string>>(() => loadFlags());
  const [overrides, setOverrides] = useState<Set<RentalClass>>(() => loadOverrides());
  const canFlag    = user ? canFlagReservation(user.role) : false;
  const canOverride = user ? canSetOverride(user.role) : false;
  const flaggedReservations = useMemo(() => today.filter(r => flags.has(r.id)), [today, flags]);

  const handleToggleOverride = (cls: RentalClass) => setOverrides(toggleOverride(cls));
  const handleClearOverrides = () => { clearAllOverrides(); setOverrides(new Set()); };

  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const toggleFlag = (id: string) => {
    if (flags.has(id)) {
      removeFlag(id);
      setFlags(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      saveFlag(id);
      setFlags(prev => new Set([...prev, id]));
    }
  };

  const seasonCfg = SEASON_CONFIG[season];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            📋 Outbound Manifest
          </h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            {seasonCfg.label} {seasonCfg.badge}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDate(now)} · {today.length} reservations
          {canFlag && <span className="ml-2 text-gray-400 dark:text-gray-600">· tap 🚩 to flag priority</span>}
        </p>
      </div>

      {/* Airport Override */}
      {(canOverride || overrides.size > 0) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              📞 Airport Override
            </p>
            {canOverride && overrides.size > 0 && (
              <button
                type="button"
                onClick={handleClearOverrides}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {canOverride ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-orange-200 dark:border-orange-800/50 p-3 transition-colors">
              <div className="flex flex-wrap gap-1.5">
                {ALL_RENTAL_CLASSES.map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => handleToggleOverride(cls)}
                    title={CLASS_LABELS[cls]}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      overrides.has(cls)
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-400 dark:ring-red-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
              {overrides.size > 0 ? (
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-2.5 font-medium">
                  {[...overrides].map(c => `${c} · ${CLASS_LABELS[c]}`).join('  ·  ')}
                </p>
              ) : (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                  Tap a class — shows in driver's must-fulfill immediately
                </p>
              )}
            </div>
          ) : overrides.size > 0 ? (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl px-4 py-2.5 transition-colors">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                📞 Airport called · {[...overrides].join(', ')} needed now
              </p>
            </div>
          ) : null}
        </section>
      )}

      {/* Priority Flagged */}
      {flaggedReservations.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            🚨 Priority — Must Fulfill
          </p>
          <div className="rounded-xl border border-red-200 dark:border-red-800 overflow-hidden divide-y divide-red-100 dark:divide-red-900/40">
            {flaggedReservations.map(r => (
              <ReservationRow
                key={r.id}
                reservation={r}
                priority={priority}
                highlight={false}
                past={isPast(r.time, now)}
                flagged
                canFlag={canFlag}
                onToggleFlag={() => toggleFlag(r.id)}
              />
            ))}
          </div>
        </section>
      )}

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
                  highlight={!flags.has(r.id)}
                  past={false}
                  flagged={flags.has(r.id)}
                  canFlag={canFlag}
                  onToggleFlag={() => toggleFlag(r.id)}
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
            const past    = isPast(r.time, now);
            const current = isCurrentWindow(r.time, now);
            return (
              <div key={r.id}>
                {current && (
                  <div ref={nowLineRef} className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                    <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 shrink-0">NOW</span>
                    <div className="flex-1 h-px bg-yellow-400 dark:bg-yellow-500" />
                  </div>
                )}
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
                  highlight={nextFiveIds.has(r.id) && !flags.has(r.id)}
                  past={past}
                  flagged={flags.has(r.id)}
                  canFlag={canFlag}
                  onToggleFlag={() => toggleFlag(r.id)}
                />
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
