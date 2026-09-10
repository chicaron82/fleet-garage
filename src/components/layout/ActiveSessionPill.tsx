import { useActiveSessions, type ActiveSession, type FocusTab } from '../../context/ActiveSessionsContext';
import { elapsedLabel } from '../../lib/activeSessions';
import { hapticLight } from '../../lib/haptics';
import type { Module, Screen } from '../../types';

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
      aria-label={`${s.label} · ${elapsedLabel(s.startedAt, nowMs)}`}
      className={`flex items-center gap-1 rounded-full font-semibold ${TONES[tone]} active:scale-95 transition cursor-pointer pl-2 pr-2.5 py-1 text-[11px] shadow-sm`}
    >
      <span className="motion-safe:animate-pulse text-[9px] leading-none">●</span>
      <span className="font-mono tabular-nums opacity-90">
        {`${s.emoji} ${elapsedLabel(s.startedAt, nowMs)}`}
      </span>
    </button>
  );
}

/**
 * Persistent pill that surfaces an active trip or off-standard timer so it's
 * visible outside the movement-log module.
 *
 * ONE PLACEMENT, EVERY SIZE — the app-shell top bar. Until 2026-09-10 there were two: compact pills
 * in the phone header and a floating bottom-centre overlay on desktop, chosen by a media query.
 * When the top bar became visible at every size, the two would have shown at once, and Aaron
 * settled it: *"yes yes!! one spot everywhere! consistency :)"*
 *
 * Each pill suppresses on its own source tab so the reminder never competes
 * with the live session card it's reminding you about.
 */
export function ActiveSessionPill({
  activeModule,
  onNavigate,
}: {
  activeModule: Module;
  onNavigate: (s: Screen) => void;
}) {
  const { trip, oth, nowMs, movementTab, setMovementTab } = useActiveSessions();

  // Each pill suppresses on its own matching tab — the reminder is redundant
  // when you're already looking at the live session card.
  const onMovementLog = activeModule === 'movement-log';
  const showTrip = !!trip && !(onMovementLog && movementTab === 'movement-log');
  const showOth  = !!oth  && !(onMovementLog && movementTab === 'off-standard');

  if (!showTrip && !showOth) return null;

  const go = (tab: FocusTab) => {
    hapticLight();
    setMovementTab(tab);
    onNavigate({ name: 'movement-log' });
  };

  return (
    <div className="flex items-center gap-1.5">
      {showTrip && <SessionPillButton s={trip!} nowMs={nowMs} tone="amber" onTap={() => go('movement-log')} />}
      {showOth  && <SessionPillButton s={oth!}  nowMs={nowMs} tone="teal"  onTap={() => go('off-standard')} />}
    </div>
  );
}
