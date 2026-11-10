// The fake Supabase the bay log's database tests share (lotBayHoldExit, lotBayErinNoteHold): just the chains
// lotBayLogDb.ts issues — select|update|insert|upsert|delete → eq|is|not → single|maybeSingle|then.
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;

/** Just the chains exitCar / undoExit / moveCount issue: select|update → eq|is → single|maybeSingle, and insert. */
export function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  let nextId = 100;
  const from = (t: string) => {
    let patch: Row | null = null;
    let inserted: Row | null = null;
    const filters: [string, unknown][] = [];
    const notNull: string[] = [];
    let deleting = false;
    // An update chained to `.select(…)` answers the rows it changed, as Supabase does (sendAllUp, 2026-11-10).
    let returning = false;
    // `.or('shift_day.eq.D,exit.is.null')`, the one or() lotBayLogDb issues (addCleaned's day read). Only a read with an
    // or() answers rows from `then`; the others stay null, as the tests before it were written against.
    let anyOf: [string, unknown][] | null = null;
    // removeRow's taps read (2026-11-06): `.gt(k, iso)` compared as instants, `.in(k, list)`. A read with either answers
    // rows from `then`, as an or() read does.
    const after: [string, string][] = [];
    const within: [string, readonly unknown[]][] = [];
    // sentUpByTrip's read (2026-11-09): `.order(k, { ascending })` answers its rows from `then`, sorted.
    let sorted: [string, boolean] | null = null;
    const match = (r: Row) => filters.every(([k, v]) => r[k] === v) && notNull.every(k => r[k] != null)
      && after.every(([k, iso]) => Date.parse(String(r[k])) > Date.parse(iso)) && within.every(([k, vs]) => vs.includes(r[k]));
    const run = () => {
      const hit = (tables[t] ?? []).filter(match);
      if (patch) hit.forEach(r => Object.assign(r, patch));
      return hit.map(r => ({ ...r }));
    };
    const q = {
      select: () => { if (patch) returning = true; return q; },
      update: (p: Row) => { patch = p; return q; },
      insert: (r: Row) => { const row = t === 'lot_bay_log' ? { id: nextId++, exit: null, ...r } : { ...r }; tables[t].push(row); inserted = row; return q; },
      upsert: (r: Row) => { tables[t] = [{ ...r }]; inserted = tables[t][0]; return q; },
      delete: () => { deleting = true; return q; },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      is: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      // Only `.not(k, 'is', null)` is used: a row whose k is set.
      not: (k: string) => { notNull.push(k); return q; },
      gt: (k: string, iso: string) => { after.push([k, iso]); return q; },
      in: (k: string, vs: readonly unknown[]) => { within.push([k, vs]); return q; },
      order: (k: string, o?: { ascending?: boolean }) => { sorted = [k, o?.ascending !== false]; return q; },
      or: (spec: string) => {
        anyOf = spec.split(',').map(p => { const [k, op, v] = p.split('.'); return [k!, op === 'is' && v === 'null' ? null : v]; });
        return q;
      },
      then: (ok: (v: unknown) => void) => {
        if (anyOf) {
          const any = anyOf;
          return ok({ data: (tables[t] ?? []).filter(r => any.some(([k, v]) => (v === null ? r[k] == null : r[k] === v))).map(r => ({ ...r })), error: null });
        }
        if (after.length || within.length) return ok({ data: run(), error: null });
        if (sorted) {
          const [k, up] = sorted;
          return ok({ data: run().sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : String(a[k]) > String(b[k]) ? 1 : 0) * (up ? 1 : -1)), error: null });
        }
        // An update awaited with no select (removeRow clearing a link): it lands.
        if (patch && !deleting) { const hit = run(); return ok({ data: returning ? hit : null, error: null }); }
        if (!deleting) return ok({ data: null, error: null });
        const gone = (tables[t] ?? []).filter(r => filters.every(([k, v]) => r[k] === v));
        tables[t] = (tables[t] ?? []).filter(r => !gone.includes(r));
        return ok({ data: gone.map(r => ({ ...r })), error: null });
      },
      single: async () => { if (inserted) return { data: { ...inserted }, error: null }; const r = run(); return r.length === 1 ? { data: r[0], error: null } : { data: null, error: new Error(`${r.length} rows`) }; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}
