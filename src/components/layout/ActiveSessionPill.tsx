import { useState, useEffect } from 'react';
import { useActiveSessions, type ActiveSession, type FocusTab } from '../../context/ActiveSessionsContext';
import { elapsedLabel } from '../../lib/activeSessions';
import { hapticLight } from '../../lib/haptics';
import type { Screen } from '../../types';

const TONES = {
  amber: 'bg-amber-500 hover:bg-amber-400 text-white',
  teal:  'bg-teal-600 hover:bg-teal-500 text-white',
} as const;

function SessionPillButton({ s, nowMs, tone, onTap }: {
  s: ActiveSession; nowMs: number; tone: keyof typeof TONES; onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full shadow-lg text-xs font-semibold ${TONES[tone]} active:scale-95 transition cursor-pointer`}
    >
      <span className="motion-safe:animate-pulse text-[10px] leading-none">●</span>
      <span>{s.emoji} {s.label}</span>
      <span className="font-mono tabular-nums opacity-90">· {elapsedLabel(s.startedAt, nowMs)}</span>
    </button>
  );
}

/**
 * Persistent pill in the app shell. Whenever a trip or off-standard timer is
 * running it floats above the content (any module), ticking live elapsed, and
 * taps through to the session so it can be ended. Renders nothing when idle.
 */
export function ActiveSessionPill({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { trip, oth, setMovementTab } = useActiveSessions();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const anyActive = !!trip || !!oth;
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyActive]);

  if (!anyActive) return null;

  const go = (tab: FocusTab) => {
    hapticLight();
    setMovementTab(tab);
    onNavigate({ name: 'movement-log' });
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap justify-center gap-2 px-4 max-w-[calc(100vw-2rem)]">
      {trip && <SessionPillButton s={trip} nowMs={nowMs} tone="amber" onTap={() => go('movement-log')} />}
      {oth  && <SessionPillButton s={oth}  nowMs={nowMs} tone="teal"  onTap={() => go('off-standard')} />}
    </div>
  );
}
