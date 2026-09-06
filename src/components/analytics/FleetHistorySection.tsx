import { useMemo } from 'react';
import { SectionHeader, EmptyState } from './AnalyticsComponents';
import { useFleetHistory, FG_RECORD_START } from '../../hooks/useFleetHistory';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import {
  liveFleet, monthlyHolds, damageByClass, seenSpread, classCoverage, projectSightings,
} from '../../lib/fleetHistory';

// What FG has RECORDED — the half of Analytics built on real rows rather than demo scaffolding.
//
// ⭐⭐ Aaron, 2026-09-05: *"whatcha think of redoing the analytics module or making a version of one
// that is useful for me instead of one that's essentially all demo from the existing one"*, and
// *"I'm more interested in history than right now. I don't have the data to handle right now
// realtime."* So: history only, and only where FG genuinely holds the rows.
//
// ⚠️⚠️ DELIBERATELY NOT ON THIS SCREEN, and each absence is a decision:
//   · Anything LIVE. FG cannot see what is on the lot or what the counter has left — `status` is a
//     damage state, not availability. A "cars available now" figure here would be a guess wearing a
//     number's clothes.
//   · Any "% of fleet never seen" figure. The sightings table is weeks old, so that number would
//     describe the TABLE'S AGE, not the yard.
//   · Seeded rows: everything before 2026-04-05, and every hold authored by a crew voice.

const HORIZONS = [{ label: 'in a month', days: 30 }, { label: 'end of year', days: 116 }];

function Bar({ pct, thin }: { pct: number; thin: boolean }) {
  return (
    <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <span className={`block h-full rounded-full ${thin ? 'bg-gray-400 dark:bg-gray-500' : 'bg-fg-yellow'}`}
        style={{ width: `${Math.round(pct * 100)}%` }} />
    </span>
  );
}

export function FleetHistorySection() {
  const { holdDates, flaggedVehicleIds, sightingsByVehicle, window: win, loading, error } = useFleetHistory();
  const { vehicles } = useVehicleHoldContext();

  const model = useMemo(() => {
    const fleet = liveFleet(vehicles).map(v => ({ id: v.id, rentalClass: v.rentalClass ?? null }));
    const byId = new Map(fleet.map(v => [v.id, v.rentalClass]));

    const hitByClass: Record<string, number> = {};
    for (const id of flaggedVehicleIds) {
      const cls = byId.get(id);
      if (cls) hitByClass[cls] = (hitByClass[cls] ?? 0) + 1;
    }
    const seenByClass: Record<string, { met: number; sightings: number }> = {};
    for (const [id, n] of sightingsByVehicle) {
      const cls = byId.get(id);
      if (!cls) continue;                       // a sighting of an archived/mock car counts nowhere
      const s = seenByClass[cls] ??= { met: 0, sightings: 0 };
      s.met += 1; s.sightings += n;
    }
    const metCars = [...sightingsByVehicle.entries()].filter(([id]) => byId.has(id));
    const totalSightings = metCars.reduce((t, [, n]) => t + n, 0);

    return {
      months: monthlyHolds(holdDates),
      totalHolds: holdDates.length,
      classes: damageByClass(fleet, hitByClass),
      spread: seenSpread(metCars.map(([, n]) => n)),
      coverage: classCoverage(fleet, seenByClass),
      metCount: metCars.length,
      totalSightings,
      fleetSize: fleet.length,
      projection: win
        ? projectSightings({ days: win.days, sightings: totalSightings, cars: metCars.length }, fleet.length, HORIZONS)
        : [],
    };
  }, [vehicles, holdDates, flaggedVehicleIds, sightingsByVehicle, win]);

  if (loading) return <EmptyState message="Reading the record…" />;
  if (error) return <EmptyState message="Couldn't read the history. It's a read — try again." />;
  if (model.totalHolds === 0 && model.metCount === 0) return null;

  const peak = Math.max(1, ...model.months.map(m => m.count));

  return (
    <section className="space-y-4">
      <SectionHeader title="What FG has recorded" />

      {/* ── 1 · damage flagged, by month ───────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {model.totalHolds} holds since FG started
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          FG&apos;s first real record is <b>{FG_RECORD_START}</b>. Anything earlier was seeded and
          isn&apos;t counted.
        </p>
        <div className="flex items-end gap-1.5 h-24 mt-3">
          {model.months.map(m => (
            <div key={m.month} className="flex-1 flex flex-col justify-end gap-1 h-full">
              <span className="text-[10px] text-center tabular-nums text-gray-500 dark:text-gray-400">{m.count}</span>
              {/* ⚠️ A PARTIAL MONTH IS HATCHED, never drawn solid. Six days plotted like a finished
                  month reads as damage collapsing rather than time not having passed. */}
              <div className={`rounded-t ${m.partial
                  ? 'bg-[repeating-linear-gradient(135deg,theme(colors.gray.400)_0_3px,transparent_3px_6px)] dark:bg-[repeating-linear-gradient(135deg,theme(colors.gray.500)_0_3px,transparent_3px_6px)] border border-gray-300 dark:border-gray-600'
                  : 'bg-fg-yellow'}`}
                style={{ height: `${Math.max(4, (m.count / peak) * 100)}%` }}
                title={m.partial ? `${m.label} — still in progress` : m.label} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {model.months.map(m => (
            <span key={m.month} className="flex-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
              {m.label}{m.partial ? '*' : ''}
            </span>
          ))}
        </div>
        {model.months.some(m => m.partial) && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">* still in progress</p>
        )}
      </div>

      {/* ── 2 · how much of each class has been flagged ────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          How much of each class has been flagged
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          The share of cars in that class flagged <b>at least once</b> since {FG_RECORD_START} —
          not a rate. A car flagged four times counts once.
        </p>
        <div className="mt-3 space-y-1.5">
          {model.classes.map(c => (
            <div key={c.rentalClass} className={`flex items-center gap-2 text-[11px] ${c.thin ? 'opacity-55' : ''}`}>
              <span className="font-mono font-semibold w-8 text-gray-900 dark:text-gray-100">{c.rentalClass}</span>
              <Bar pct={c.share} thin={c.thin} />
              <span className="tabular-nums w-9 text-right text-gray-600 dark:text-gray-300">
                {Math.round(c.share * 100)}%
              </span>
              <span className="tabular-nums w-14 text-right text-gray-400 dark:text-gray-500">
                {c.hit}/{c.fleet}
              </span>
              {/* ⚠️ Marked, never hidden. T4 at 100% is 4-of-4 — true, and not worth reacting to. */}
              {c.thin && <span className="text-[9px] text-gray-400 dark:text-gray-500 w-7">thin</span>}
              {!c.thin && <span className="w-7" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3 · what FG has met on shift ───────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {model.metCount} cars met{win ? ` in ${win.days} days` : ''}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          <b>{model.totalSightings} sightings</b>{win ? ` since ${win.first}` : ''}. This counts the
          window, not the fleet — a car absent here hasn&apos;t come through, it isn&apos;t missing.
        </p>

        <div className="mt-3 space-y-1.5">
          {model.spread.map(b => (
            <div key={b.times} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 text-gray-500 dark:text-gray-400">
                {b.times === 1 ? 'seen once' : b.capped ? `${b.times}× or more` : `${b.times}×`}
              </span>
              <Bar pct={b.cars / Math.max(1, model.metCount)} thin={false} />
              <span className="tabular-nums w-9 text-right text-gray-600 dark:text-gray-300">{b.cars}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-4">
          How much of each class FG has met
        </p>
        <div className="mt-1.5 space-y-1">
          {model.coverage.filter(c => c.met > 0).map(c => (
            <div key={c.rentalClass} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono font-semibold w-8 text-gray-900 dark:text-gray-100">{c.rentalClass}</span>
              <Bar pct={c.share} thin={c.fleet < 15} />
              <span className="tabular-nums w-9 text-right text-gray-600 dark:text-gray-300">
                {Math.round(c.share * 100)}%
              </span>
              <span className="tabular-nums w-14 text-right text-gray-400 dark:text-gray-500">
                {c.met}/{c.fleet}
              </span>
              {/* Sightings per MET car — not per fleet car, which would blend "seen constantly" with
                  "mostly not met yet" into one number meaning neither. */}
              <span className="tabular-nums w-9 text-right text-gray-500 dark:text-gray-400">
                {c.perCar.toFixed(1)}×
              </span>
            </div>
          ))}
        </div>

        {model.projection.length > 0 && (
          /* ⚠️⚠️ DASHED AND LABELLED, because a forecast that looks like a measurement is the
             failure mode of this whole card. */
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Where this is going <span className="normal-case font-normal text-gray-400 dark:text-gray-500">· projection, not measured</span>
            </p>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-baseline gap-2 text-[11px]">
                <span className="w-20 text-gray-500 dark:text-gray-400">now</span>
                <span className="flex-1 tabular-nums text-gray-400 dark:text-gray-500">
                  {model.totalSightings} sightings · {model.metCount} cars
                </span>
                <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-200">
                  {(model.totalSightings / Math.max(1, model.metCount)).toFixed(1)}×
                </span>
              </div>
              {model.projection.map(p => (
                <div key={p.label} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-20 text-gray-500 dark:text-gray-400">{p.label}</span>
                  <span className="flex-1 tabular-nums text-gray-400 dark:text-gray-500">
                    ~{p.sightings} · ~{p.cars} cars
                  </span>
                  <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-200">
                    {p.multiple.toFixed(1)}×
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Straight-line from the observed rate. Coverage stops at the fleet, so once FG has met
              nearly everything, <b>frequency becomes the whole story</b> — the workhorses separating
              from the cars that sit. Today&apos;s flat multiple is day one of that measurement.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
