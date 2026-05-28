import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapIssue } from '../lib/garage-mappers';
import { useIssues, type IssuesSlice } from './useIssues';

const IssueContext = createContext<IssuesSlice | null>(null);

export function IssueProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { setFacilityIssues, ...slice } = useIssues(user, activeBranch);

  useEffect(() => {
    supabase
      .from('facility_issues')
      .select('*')
      .order('reported_at', { ascending: false })
      .then(({ data }) => {
        if (data) setFacilityIssues(data.map(mapIssue));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <IssueContext.Provider value={slice}>
      {children}
    </IssueContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIssueContext(): IssuesSlice {
  const ctx = useContext(IssueContext);
  if (!ctx) throw new Error('useIssueContext must be used within IssueProvider');
  return ctx;
}
