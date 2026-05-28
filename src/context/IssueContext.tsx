import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapIssue } from '../lib/garage-mappers';
import { useIssues, type IssuesSlice } from './useIssues';

export type IssueContextValue = IssuesSlice & { loadError: boolean };

const IssueContext = createContext<IssueContextValue | null>(null);

export function IssueProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { setFacilityIssues, ...slice } = useIssues(user, activeBranch);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase
      .from('facility_issues')
      .select('*')
      .order('reported_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[IssueContext] Initial load failed:', error);
          setLoadError(true);
        }
        if (data) setFacilityIssues(data.map(mapIssue));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <IssueContext.Provider value={{ ...slice, loadError }}>
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
