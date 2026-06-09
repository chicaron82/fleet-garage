import { supabase, writeWithRefresh } from './supabase';
import { enqueueOfflineAction } from './offlineQueue';

type OffStandardTable = 'off_standard_entries' | 'holds';

/**
 * Attempts a Supabase write to one of the two tables the off-standard timer
 * touches (`off_standard_entries` and the EDV-linked `holds` row); falls back
 * to the offline queue on network errors. Returns { ok: true } on success
 * (online or queued), or { ok: false } on a real (non-network) failure.
 *
 * The off-standard twin of `vsaTripWrite.writeOrEnqueue` — same offline-fallback
 * contract, generalised over a `table` param. Because it spans two tables it
 * uses runtime-dynamic dispatch through the untyped client (see
 * executeOfflineAction), rather than the typed Insert/Update casts the
 * single-table vsa_trips helper can afford.
 *
 * Keep this awaited before any live-state setter — the write-first handlers in
 * useOffStandardSession (handleStartWith) depend on the write landing first.
 */
export async function writeOrEnqueue(
  action: 'insert' | 'update' | 'delete',
  table: OffStandardTable,
  payload: Record<string, unknown>,
  eqField?: string,
  eqValue?: string,
): Promise<{ ok: boolean }> {
  // A delete without a filter would wipe the whole table — refuse it outright.
  if (action === 'delete' && (!eqField || eqValue === undefined)) {
    console.error('[offStandardWrite] refusing an unscoped delete');
    return { ok: false };
  }
  // An insert without a client-generated primary key can't be safely de-duplicated
  // on an offline retry: the queue's upsert-on-conflict needs `id` to turn a
  // lost-ack replay into a no-op instead of a second row. Both tables use `id` as
  // their client-supplied PK. Refuse loudly rather than risk a dupe — same
  // fail-fast posture as the unscoped-delete guard above.
  if (action === 'insert' && payload.id == null) {
    console.error('[offStandardWrite] refusing an insert missing its primary key (id)');
    return { ok: false };
  }
  const enqueue = () => enqueueOfflineAction({ table, action, payload, eqField, eqValue });
  if (!navigator.onLine) { enqueue(); return { ok: true }; }
  const res = await writeWithRefresh(() => {
    // Runtime-dynamic table dispatch — bypass the typed client (see executeOfflineAction).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (supabase as any).from(table);
    if (action === 'insert') return query.insert(payload);
    if (action === 'update') {
      const q = query.update(payload);
      return eqField && eqValue !== undefined ? q.eq(eqField, eqValue) : q;
    }
    const q = query.delete();
    return eqField && eqValue !== undefined ? q.eq(eqField, eqValue) : q;
  });
  if (!res.error) return { ok: true };
  const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
  if (isNetworkErr) { enqueue(); return { ok: true }; }
  return { ok: false };
}
