import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SectionHeader, EmptyState } from '../../lib/analytics';
import type { VehicleRegistryEntry } from '../../types';

interface Props { activeBranch: string; }

function minutesSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function vehicleLabel(entry: VehicleRegistryEntry): string {
  const parts: string[] = [];
  if (entry.unitNumber) parts.push(entry.unitNumber);
  if (entry.plate)      parts.push(entry.plate);
  if (entry.make || entry.model) {
    parts.push([entry.color, entry.make, entry.model].filter(Boolean).join(' '));
  }
  return parts.join(' · ') || 'Unknown vehicle';
}

type Row = Record<string, unknown>;

function mapRow(row: Row): VehicleRegistryEntry {
  return {
    id:           row['id']          as string,
    branchId:     row['branch_id']   as string,
    vehicleId:    (row['vehicle_id']    as string | null) ?? null,
    plate:        (row['plate']         as string | null) ?? null,
    unitNumber:   (row['unit_number']   as string | null) ?? null,
    make:         (row['make']          as string | null) ?? null,
    model:        (row['model']         as string | null) ?? null,
    year:         (row['year']          as number | null) ?? null,
    color:        (row['color']         as string | null) ?? null,
    arrivedAt:    (row['arrived_at']    as string | null) ?? null,
    cleanedAt:    (row['cleaned_at']    as string | null) ?? null,
    dispatchedAt: (row['dispatched_at'] as string | null) ?? null,
    needsReview:  (row['needs_review']  as boolean)       ?? false,
    createdAt:    row['created_at']  as string,
    date:         row['date']        as string,
  };
}

export function TurnaroundSection({ activeBranch }: Props) {
  const [entries, setEntries] = useState<VehicleRegistryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from('vehicle_registry')
      .select('*')
      .eq('date', today);
    if (activeBranch !== 'ALL') q = q.eq('branch_id', activeBranch);
    q.order('arrived_at', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setEntries((data ?? []).map(r => mapRow(r as Row)));
        setLoading(false);
      });
  }, [activeBranch]);

  const waiting    = entries.filter(e => e.arrivedAt && !e.dispatchedAt).sort((a, b) =>
    (a.arrivedAt! < b.arrivedAt! ? -1 : 1) // oldest first — longest waiters at top
  );
  const dispatched = entries.filter(e => e.arrivedAt && e.dispatchedAt).sort((a, b) =>
    (a.dispatchedAt! > b.dispatchedAt! ? -1 : 1) // most recent dispatch at top
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors space-y-4">
      <SectionHeader title="Vehicle Turnaround · Today" />

      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState message="No registry activity yet today. Records appear as vehicles check in and dispatch." />
      )}

      {!loading && waiting.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Waiting — {waiting.length}
          </p>
          <div className="space-y-2">
            {waiting.map(entry => {
              const mins  = entry.arrivedAt ? minutesSince(entry.arrivedAt) : 0;
              const isLong = mins > 90;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {vehicleLabel(entry)}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${
                    isLong ? 'text-amber-500' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {fmtDuration(mins)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && dispatched.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Dispatched — {dispatched.length}
          </p>
          <div className="space-y-2">
            {dispatched.map(entry => {
              const total = entry.arrivedAt && entry.dispatchedAt
                ? minutesBetween(entry.arrivedAt, entry.dispatchedAt)
                : null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {vehicleLabel(entry)}
                  </span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    {total !== null ? fmtDuration(total) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
