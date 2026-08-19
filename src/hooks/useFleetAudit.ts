// The fleet audit's live state: the findings, and which ones he has already settled.
//
// Its own hook rather than another branch of the Fleet view because the dismissals are a WRITE with
// their own lifecycle — and because the audit is a different question from the list it sits above
// ("is this data self-consistent?" vs "what's in the yard?").
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { auditFleet, type AuditVehicle, type FleetAuditFinding } from '../lib/fleetAudit';

export function useFleetAudit(vehicles: readonly AuditVehicle[], branchId?: string | null) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from('fleet_audit_dismissals').select('finding_key');
      if (cancelled) return;
      setDismissed((data ?? []).map(r => r.finding_key as string));
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(async (key: string) => {
    // Optimistic: the finding disappears on tap. A failed write costs him seeing it again next
    // load, which is the harmless direction — the alternative is a list that feels broken.
    setDismissed(prev => prev.includes(key) ? prev : [...prev, key]);
    const { error } = await supabase
      .from('fleet_audit_dismissals')
      .upsert({ finding_key: key, branch_id: branchId ?? null }, { onConflict: 'finding_key' });
    if (error) console.error('[useFleetAudit] dismiss failed:', error.message);
  }, [branchId]);

  // Findings are withheld until the dismissals have loaded. Rendering them first would flash items
  // he settled weeks ago — and on an audit surface a flash of resolved problems reads as a
  // regression, not as loading.
  const findings: FleetAuditFinding[] = loaded ? auditFleet(vehicles, dismissed) : [];

  return { findings, dismiss, loaded };
}
