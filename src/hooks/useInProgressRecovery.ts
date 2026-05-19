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
  /** Called after the recovery query resolves, whether or not a record was found. */
  onSettled?: () => void;
}

/**
 * Mount-time recovery hook for the Write-First Pattern.
 *
 * Fires once per `userId` change. On finding an `in_progress` row, calls
 * `onRecover` so the component can rehydrate UI state. Always calls
 * `onSettled` when the query resolves, enabling callers to clear loading states.
 *
 * Both callbacks are held in refs so their identity does not re-trigger the
 * effect — callers can pass inline arrows without memoizing.
 */
export function useInProgressRecovery(
  opts: UseInProgressRecoveryOptions,
  onRecover: (row: RecoveryRow) => void,
): void {
  const onRecoverRef = useRef(onRecover);
  useEffect(() => {
    onRecoverRef.current = onRecover;
  });

  const onSettledRef = useRef(opts.onSettled);
  useEffect(() => {
    onSettledRef.current = opts.onSettled;
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
      onSettledRef.current?.();
    });
  }, [table, userField, userId, columns]);
}
