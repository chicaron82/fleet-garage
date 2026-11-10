// A mounted card offers its own End to the header pill while its session runs (docs/ticket-pill-tap-ends-session.md).
// The registered function is stable and always calls the card's LATEST handler, so it ends with what the card holds now
// (a note typed in transit, an authorization changed on the way).
import { useEffect, useRef } from 'react';
import { useActiveSessions, type SessionEnder, type SessionKind } from '../context/ActiveSessionsContext';

export function useSessionEnder(kind: SessionKind, running: boolean, end: SessionEnder) {
  const { registerEnder } = useActiveSessions();
  const latest = useRef(end);
  useEffect(() => { latest.current = end; });
  useEffect(() => {
    if (!running) return;
    registerEnder(kind, at => latest.current(at));
    return () => registerEnder(kind, null);
  }, [kind, running, registerEnder]);
}
