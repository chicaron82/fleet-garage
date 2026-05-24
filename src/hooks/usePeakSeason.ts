import { useState, useEffect } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';

interface PeakSeasonState {
  isPeakSeason: boolean;
  togglePeakSeason: () => Promise<void>;
}

export function usePeakSeason(): PeakSeasonState {
  const [isPeakSeason, setIsPeakSeason] = useState(false);

  useEffect(() => {
    supabase
      .from('branch_settings')
      .select('peak_season')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsPeakSeason(data.peak_season as boolean);
      });
  }, []);

  const togglePeakSeason = async () => {
    const next = !isPeakSeason;
    const { error } = await writeWithRefresh(() =>
      supabase
        .from('branch_settings')
        .update({ peak_season: next, updated_at: new Date().toISOString() })
        .eq('id', 1)
    );
    if (error) throw error;
    setIsPeakSeason(next);
  };

  return { isPeakSeason, togglePeakSeason };
}
