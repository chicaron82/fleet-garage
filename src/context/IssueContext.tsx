import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { currentFaultByIssue } from '../lib/currentFault';
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
      // ⭐ The CURRENT fault rides in with the list (Aaron, 2026-09-20: the machine is the record,
      // the fault is what's wrong with it this time). One extra read of the trail, not one per card
      // — the card's own lazy event fetch stays for the full history.
      // ⚠️ A failed trail read must not cost him the issues: the list still renders, each machine
      // showing its first fault, which is exactly what it showed before this existed.
      const { data: trail } = await supabase
        .from('issue_events')
        .select('issue_id, event_type, note, created_at')
        .eq('event_type', 'reopened');
      const current = currentFaultByIssue((trail ?? []).map(r => ({
        issueId: r.issue_id as string,
        eventType: r.event_type as string,
        note: r.note as string | null,
        createdAt: r.created_at as string,
      })));
      setFacilityIssues(data.map(row => {
        const issue = mapIssue(row);
        return { ...issue, currentFault: current.get(issue.id) };
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
