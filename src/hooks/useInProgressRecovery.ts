import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  recoverInProgress,
  type RecoveryClient,
  type RecoveryRow,
} from '../lib/in-progress-recovery';

// SupabaseClient v2 has very deep generic instantiation; casting once at the
// boundary keeps `recoverInProgress` generic-free at call sites and avoids
// `TS2589: Type instantiation is excessively deep`.
const client = supabase as unknown as RecoveryClient;

interface UseInProgressRecoveryOptions {
  /** Table to query (e.g. `'vsa_trips'`, `'off_standard_entries'`). */
  table: string;
  /** Column linking the row to the current user (e.g. `'user_id'`, `'driver_id'`). */
  userField: string;
  /** Current user's id. When `null` or `undefined` the effect is skipped. */
  userId: string | null | undefined;
  /** Columns to project. Defaults to `'*'`. */
  columns?: string;
}

/**
 * Mount-time recovery hook for the Write-First Pattern.
 *
 * Fires once per `userId` change. On finding an `in_progress` row, calls
 * `onRecover` so the component can rehydrate UI state.
 *
 * The `onRecover` callback is held in a ref so its identity does not
 * re-trigger the effect — callers can pass an inline arrow without memoizing.
 */
export function useInProgressRecovery(
  opts: UseInProgressRecoveryOptions,
  onRecover: (row: RecoveryRow) => void,
): void {
  const onRecoverRef = useRef(onRecover);
  useEffect(() => {
    onRecoverRef.current = onRecover;
  });

  const { table, userField, userId, columns } = opts;

  useEffect(() => {
    if (!userId) return;
    void recoverInProgress({
      client,
      table,
      userField,
      userId,
      columns,
    }).then(row => {
      if (row) onRecoverRef.current(row);
    });
  }, [table, userField, userId, columns]);
}
