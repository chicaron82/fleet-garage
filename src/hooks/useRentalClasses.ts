import { useCallback, useEffect, useState } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';

/** One chip in the operator-curated rental-class list (migration 106). */
export interface RentalClassChip {
  code: string;
  label: string | null;
  sortOrder: number;
}

/**
 * The rental-class chip list — Aaron's own list, loaded from `rental_classes` and mutated in place.
 * `addClass` is the "Other" path (a new code seen on the lot); `removeClass` is the long-press delete
 * (a typo, or a class that left the fleet). A vehicle's `rental_class` string is independent of this
 * list — deleting a chip never touches a car; it just stops offering that option.
 */
export function useRentalClasses() {
  const [classes, setClasses] = useState<RentalClassChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('rental_classes')
      .select('code, label, sort_order')
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setClasses((data ?? []).map((r) => ({ code: r.code, label: r.label, sortOrder: r.sort_order })));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  /** Add a class ("Other"). Codes are upper-cased + trimmed; the PK makes a re-add a harmless no-op. */
  const addClass = useCallback(
    async (rawCode: string, label?: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      // Append after the current max so a new code lands at the end, not mid-list.
      const nextSort = classes.length ? Math.max(...classes.map((c) => c.sortOrder)) + 10 : 10;
      const { error } = await writeWithRefresh(() =>
        supabase.from('rental_classes').insert({ code, label: label?.trim() || null, sort_order: nextSort }),
      );
      // A duplicate (already in the list) is fine — the code is already an option.
      if (error && !/duplicate key/i.test(error.message)) {
        setError(error.message);
        return;
      }
      await load();
    },
    [classes, load],
  );

  /** Delete a class from the list (long-press). Never touches any vehicle's stored class. */
  const removeClass = useCallback(
    async (code: string) => {
      const { error } = await writeWithRefresh(() => supabase.from('rental_classes').delete().eq('code', code));
      if (error) {
        setError(error.message);
        return;
      }
      await load();
    },
    [load],
  );

  return { classes, loading, error, addClass, removeClass };
}
