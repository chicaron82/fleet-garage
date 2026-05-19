// Recovery half of the Write-First Pattern (see ARCHITECTURE.md).
//
// Pure async helper that loads the single `in_progress` row for a given user
// from a Supabase table. Pure so it can be unit-tested with a fake client and
// re-used by `useInProgressRecovery` (the React hook layer).
//
// Why this exists: every timed-session feature (OffStandardTimeLog,
// VSAMovementLog, DriverLiveForm, ...) needs the exact same query on mount.
// Duplicating it three times has led to subtle drift; centralizing means the
// regression suite only has to assert one thing.

// Intentionally minimal structural type. The real `SupabaseClient` satisfies
// this shape, but its actual `maybeSingle()` return is a `PostgrestBuilder`
// (a custom thenable, not a true `Promise`) — using `PromiseLike` here keeps
// both the real client and lightweight test mocks assignable.
export interface RecoveryClient {
  from(table: string): RecoveryFromBuilder;
}

export interface RecoveryFromBuilder {
  select(columns: string): RecoveryFilterBuilder;
}

export interface RecoveryFilterBuilder {
  eq(column: string, value: string): RecoveryFilterBuilder;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}

export interface RecoverInProgressOptions {
  client: RecoveryClient;
  table: string;
  /** The column linking the row to the current user (e.g. `user_id`, `driver_id`). */
  userField: string;
  /** The current user's id. */
  userId: string;
  /** Columns to project. Defaults to `*`. */
  columns?: string;
  /** Status filter. Defaults to `in_progress` — the contract value. */
  status?: string;
}

export type RecoveryRow = Record<string, unknown>;

export async function recoverInProgress(
  opts: RecoverInProgressOptions,
): Promise<RecoveryRow | null> {
  const columns = opts.columns ?? '*';
  const status  = opts.status  ?? 'in_progress';

  const { data, error } = await opts.client
    .from(opts.table)
    .select(columns)
    .eq(opts.userField, opts.userId)
    .eq('status', status)
    .maybeSingle();

  if (error) {
    console.error(`[recoverInProgress] ${opts.table} query failed:`, error);
    return null;
  }
  return data;
}
