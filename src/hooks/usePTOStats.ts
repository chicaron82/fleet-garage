import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import type { User } from '../types';

export interface PTOStats {
  ptoEntitlement: number;
  ptoUsed: number;
  sickDaysUsed: number;
  updatePtoEntitlement: (days: number) => Promise<void>;
  adjustPTO:  (delta: number) => void;
  adjustSick: (delta: number) => void;
}

export function usePTOStats(user: User | null): PTOStats {
  const [ptoEntitlement, setPtoEntitlement] = useState(15);
  const [ptoUsed,        setPtoUsed]        = useState(0);
  const [sickDaysUsed,   setSickDaysUsed]   = useState(0);

  useEffect(() => {
    if (!user) return;
    const year = new Date().getFullYear();

    supabase
      .from('user_pto')
      .select('pto_entitlement')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPtoEntitlement(data.pto_entitlement as number); });

    supabase
      .from('shifts')
      .select('shift_type')
      .eq('user_id', user.id)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .in('shift_type', ['pto', 'sick'])
      .then(({ data }) => {
        if (data) {
          const rows = data as { shift_type: string }[];
          setPtoUsed(rows.filter(r => r.shift_type === 'pto').length);
          setSickDaysUsed(rows.filter(r => r.shift_type === 'sick').length);
        }
      });
  }, [user]);

  const updatePtoEntitlement = async (days: number) => {
    if (!user) return;
    const { error } = await writeWithRefresh(() =>
      supabase
        .from('user_pto')
        .upsert({ user_id: user.id, pto_entitlement: days, updated_at: new Date().toISOString() })
    );
    if (!error) setPtoEntitlement(days);
  };

  const adjustPTO  = (delta: number) => setPtoUsed(prev => Math.max(0, prev + delta));
  const adjustSick = (delta: number) => setSickDaysUsed(prev => Math.max(0, prev + delta));

  return { ptoEntitlement, ptoUsed, sickDaysUsed, updatePtoEntitlement, adjustPTO, adjustSick };
}
