import { useActiveSessions, type ActiveSession, type FocusTab } from '../../context/ActiveSessionsContext';
import { elapsedLabel } from '../../lib/activeSessions';
import { hapticLight } from '../../lib/haptics';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Module, Screen } from '../../types';

const TONES = {
  amber: 'bg-amber-500 hover:bg-amber-400 text-white',
  teal:  'bg-teal-600 hover:bg-teal-500 text-white',
} as const;

function SessionPillButton({ s, nowMs, tone, compact, onTap }: {
  s: ActiveSession; nowMs: number; tone: keyof typeof TONES; compact: boolean; onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex items-center gap-1 rounded-full font-semibold ${TONES[tone]} active:scale-95 transition cursor-pointer ${
        compact
          ? 'pl-2 pr-2.5 py-1 text-[11px] shadow-sm'
          : 'pl-2.5 pr-3 py-1.5 text-xs shadow-lg'
      }`}
    >
      <span className="motion-safe:animate-pulse text-[9px] leading-none">●</span>
      {!compact && <span>{s.emoji} {s.label}</span>}
      <span className={`font-mono tabular-nums opacity-90 ${compact ? '' : 'ml-0.5'}`}>
        {compact ? `${s.emoji} ${elapsedLabel(s.startedAt, nowMs)}` : `· ${elapsedLabel(s.startedAt, nowMs)}`}
      </span>
    </button>
  );
}

/**
 * Persistent pill that surfaces an active trip or off-standard timer so it's
 * visible outside the movement-log module.
 *
 * variant='overlay'  — fixed bottom overlay, desktop only (md:flex hidden on mobile).
 * variant='header'   — inline compact pills for the mobile app-shell header.
 *
 * Each pill suppresses on its own source tab so the reminder never competes
 * with the live session card it's reminding you about.
 */
export function ActiveSessionPill({
  activeModule,
  onNavigate,
  variant = 'overlay',
}: {
  activeModule: Module;
  onNavigate: (s: Screen) => void;
  variant?: 'header' | 'overlay';
}) {
  const isMd = useMediaQuery('(min-width: 768px)');
  const { trip, oth, nowMs, movementTab, setMovementTab } = useActiveSessions();

  // Each pill suppresses on its own matching tab — the reminder is redundant
  // when you're already looking at the live session card.
  const onMovementLog = activeModule === 'movement-log';
  const showTrip = !!trip && !(onMovementLog && movementTab === 'movement-log');
  const showOth  = !!oth  && !(onMovementLog && movementTab === 'off-standard');

  if (!showTrip && !showOth) return null;
  if (variant === 'overlay' && !isMd) return null;

  const go = (tab: FocusTab) => {
    hapticLight();
    setMovementTab(tab);
    onNavigate({ name: 'movement-log' });
  };

  const compact = variant === 'header';
  const wrapperClass = compact
    ? 'flex items-center gap-1.5'
    : 'hidden md:flex flex-wrap justify-center gap-2 px-4 max-w-[calc(100vw-2rem)] fixed bottom-4 left-1/2 -translate-x-1/2 z-40';

  return (
    <div className={wrapperClass}>
      {showTrip && <SessionPillButton s={trip!} nowMs={nowMs} tone="amber" compact={compact} onTap={() => go('movement-log')} />}
      {showOth  && <SessionPillButton s={oth!}  nowMs={nowMs} tone="teal"  compact={compact} onTap={() => go('off-standard')} />}
    </div>
  );
}
