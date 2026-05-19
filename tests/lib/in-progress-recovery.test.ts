import { describe, it, expect, vi } from 'vitest';
import {
  recoverInProgress,
  type RecoveryClient,
  type RecoveryRow,
} from '../../src/lib/in-progress-recovery';

// ── Fake Supabase client ─────────────────────────────────────────────────────
//
// Records every chained call so tests can assert the query shape
// (table / columns / filters), and returns rows by matching the eq() filters.

interface CapturedQuery {
  table: string;
  columns: string;
  filters: Array<[string, string]>;
}

function makeFakeClient(opts: {
  rows?: RecoveryRow[];
  error?: { message: string } | null;
} = {}): { client: RecoveryClient; captured: CapturedQuery[] } {
  const rows = opts.rows ?? [];
  const error = opts.error ?? null;
  const captured: CapturedQuery[] = [];

  const client: RecoveryClient = {
    from(table: string) {
      const current: CapturedQuery = { table, columns: '', filters: [] };
      captured.push(current);
      return {
        select(columns: string) {
          current.columns = columns;
          return {
            eq(column: string, value: string) {
              current.filters.push([column, value]);
              return this;
            },
            async maybeSingle() {
              if (error) return { data: null, error };
              const match = rows.find(r =>
                current.filters.every(([col, val]) => r[col] === val),
              );
              return { data: match ?? null, error: null };
            },
          };
        },
      };
    },
  };

  return { client, captured };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('recoverInProgress — query shape', () => {
  it('queries the requested table', async () => {
    const { client, captured } = makeFakeClient();
    await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });
    expect(captured[0].table).toBe('vsa_trips');
  });

  it('defaults columns to "*" when not specified', async () => {
    const { client, captured } = makeFakeClient();
    await recoverInProgress({
      client,
      table: 'off_standard_entries',
      userField: 'user_id',
      userId: 'u1',
    });
    expect(captured[0].columns).toBe('*');
  });

  it('forwards an explicit columns projection', async () => {
    const { client, captured } = makeFakeClient();
    await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
      columns: 'id, vehicle_plate, depart_time',
    });
    expect(captured[0].columns).toBe('id, vehicle_plate, depart_time');
  });

  it('filters by the configured userField AND status=in_progress', async () => {
    const { client, captured } = makeFakeClient();
    await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u42',
    });
    expect(captured[0].filters).toEqual([
      ['driver_id', 'u42'],
      ['status', 'in_progress'],
    ]);
  });

  it('honours an overridden status filter', async () => {
    const { client, captured } = makeFakeClient();
    await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
      status: 'pending_review',
    });
    expect(captured[0].filters).toEqual([
      ['driver_id', 'u1'],
      ['status', 'pending_review'],
    ]);
  });
});

describe('recoverInProgress — return value', () => {
  it('returns the matching in-progress row when one exists', async () => {
    const row: RecoveryRow = {
      id: 'trip-1',
      driver_id: 'u1',
      status: 'in_progress',
      vehicle_plate: 'AB-1234',
    };
    const { client } = makeFakeClient({ rows: [row] });

    const result = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });
    expect(result).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    const { client } = makeFakeClient({ rows: [] });
    const result = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });
    expect(result).toBeNull();
  });

  it('returns null when the row belongs to a different user', async () => {
    const other: RecoveryRow = {
      id: 'trip-2',
      driver_id: 'u2',
      status: 'in_progress',
    };
    const { client } = makeFakeClient({ rows: [other] });
    const result = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });
    expect(result).toBeNull();
  });

  it('returns null and logs when Supabase reports an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = makeFakeClient({ error: { message: 'boom' } });

    const result = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[recoverInProgress] vsa_trips query failed:',
      { message: 'boom' },
    );
    consoleSpy.mockRestore();
  });
});

describe('recoverInProgress — contract invariants', () => {
  it('never returns a completed row (status filter is load-bearing)', async () => {
    const completed: RecoveryRow = {
      id: 'trip-3',
      driver_id: 'u1',
      status: 'complete',
    };
    const { client } = makeFakeClient({ rows: [completed] });
    const result = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });
    expect(result).toBeNull();
  });

  it('different userField names route to different rows', async () => {
    const oth: RecoveryRow = { id: 'o1', user_id: 'u1', status: 'in_progress' };
    const trip: RecoveryRow = { id: 't1', driver_id: 'u1', status: 'in_progress' };
    const { client } = makeFakeClient({ rows: [oth, trip] });

    const othResult = await recoverInProgress({
      client,
      table: 'off_standard_entries',
      userField: 'user_id',
      userId: 'u1',
    });
    const tripResult = await recoverInProgress({
      client,
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: 'u1',
    });

    expect(othResult).toEqual(oth);
    expect(tripResult).toEqual(trip);
  });
});
