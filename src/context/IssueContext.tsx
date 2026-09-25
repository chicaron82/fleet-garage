import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { openFaultsByIssue, type IssueFaultRow } from '../../api/_lib/issueFaults';
import { mapIssue } from '../lib/garage-mappers';
import { useIssues, type IssuesSlice } from './useIssues';

export type IssueContextValue = IssuesSlice & { loadError: boolean; reload: () => void };

const IssueContext = createContext<IssueContextValue | null>(null);

export function IssueProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { setFacilityIssues, ...slice } = useIssues(user, activeBranch);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  function reload() { setLoadError(false); setLoadAttempt(a => a + 1); }

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('facility_issues')
        .select('*')
        .order('reported_at', { ascending: false });
      if (error) {
        console.error('[IssueContext] Initial load failed:', error);
        setLoadError(true);
      }
      if (!data) return;
      // ⭐ Every OPEN fault rides in with the list (migration 150) — one read for all machines, not one
      // per card. ⚠️ A failed read must not cost him the issues: the list still renders, and each card
      // falls back to its first report, which is what it showed before faults existed.
      const { data: faultRows } = await supabase
        .from('issue_faults')
        .select('id, issue_id, note, photo_url, opened_at, opened_by, cleared_at')
        .is('cleared_at', null);
      const faults = openFaultsByIssue((faultRows ?? []) as IssueFaultRow[]);
      setFacilityIssues(data.map(row => {
        const issue = mapIssue(row);
        return { ...issue, faults: faults.get(issue.id) ?? [] };
      }));
    })();
  }, [loadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <IssueContext.Provider value={{ ...slice, loadError, reload }}>
      {children}
    </IssueContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIssueContext(): IssueContextValue {
  const ctx = useContext(IssueContext);
  if (!ctx) throw new Error('useIssueContext must be used within IssueProvider');
  return ctx;
}
