// My Day's side of the crew line (lot_crew, migration 154): who is on their usual job, for the box on each VSA's and
// driver's pill (docs/ticket-myday-crew-checkbox-and-grid.md). Reads and writes the SAME crew as Lot Lookout's panel
// (useLotCrew, signed in), so a pull made on either screen shows on both.
//
// A box tap shows at once and is put back, with the reason said, if the write fails: a crew line that silently
// disagrees with what he tapped is worse than none.
import { useCallback, useMemo, useState } from 'react';
import { useLotCrew } from './useLotCrew';
import { useAuth } from '../context/AuthContext';
import { initialsOf } from '../lib/lotLookout';
import type { CrewState } from '../lib/lotCrew';
import type { CrewEntry } from '../lib/rosterCrew';

export function useRosterCrew() {
  const { crew, mark, loaded } = useLotCrew({ signedIn: true });
  const { user } = useAuth();
  const by = initialsOf(user?.name ?? null) || 'FG';
  const [pending, setPending] = useState<Record<string, CrewEntry>>({});
  const [note, setNote] = useState('');

  const fromServer = useMemo(() => {
    const m = new Map<string, CrewEntry>();
    for (const c of crew?.members ?? []) m.set(c.userId, { state: c.state, marked: c.marked });
    return m;
  }, [crew]);

  const crewOf = useCallback((userId: string): CrewEntry | undefined => pending[userId] ?? fromServer.get(userId),
    [pending, fromServer]);

  const write = useCallback(async (userId: string, next: CrewState | 'clear') => {
    setNote('');
    // 'clear' shows as "no mark": the default for their role, which is what the box reads as ticked.
    setPending(p => ({ ...p, [userId]: next === 'clear' ? { state: 'cleaning', marked: false } : { state: next, marked: true } }));
    const problem = await mark([userId], next, by);
    setPending(p => { const rest = { ...p }; delete rest[userId]; return rest; });
    if (problem) setNote(`The crew line did not save: ${problem}`);
  }, [mark, by]);

  return { crewOf, write, note, loaded };
}
