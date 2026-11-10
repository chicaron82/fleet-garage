import { useActiveSessions, type ActiveSession, type FocusTab, type SessionKind } from '../../context/ActiveSessionsContext';
import { elapsedLabel } from '../../lib/activeSessions';
import { hapticLight } from '../../lib/haptics';
import { usePillEnd, type PillHeld, type PillSaid } from '../../hooks/usePillEnd';
import type { Module, Screen } from '../../types';

const TONES = {
  amber: 'bg-amber-500 hover:bg-amber-400 text-white',
  teal:  'bg-teal-600 hover:bg-teal-500 text-white',
} as const;
const CHIP = 'flex items-center gap-1 rounded-full font-semibold active:scale-95 transition cursor-pointer pl-2 pr-2.5 py-1 text-[11px] shadow-sm';

function SessionPillButton({ s, nowMs, tone, held, said, onTap, onUndo }: {
  s: ActiveSession; nowMs: number; tone: keyof typeof TONES; held?: PillHeld; said?: PillSaid;
  onTap: () => void; onUndo: () => void;
}) {
  // Held: the end waits for Undo. Nothing is written until the hold runs out.
  if (held) {
    return (
      <button type="button" onClick={onUndo} aria-label={`${held.label}. Undo`}
        className={`${CHIP} bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900`}>
        <span className="font-mono tabular-nums">{held.chip}</span>
        <span className="underline underline-offset-2">Undo</span>
      </button>
    );
  }
  if (said) {
    return (
      <button type="button" onClick={onTap} aria-label={said.ok ? said.text : `${s.label} did not save. Open it to end it`}
        className={`${CHIP} ${said.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
        {said.text}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`End ${s.label} · ${elapsedLabel(s.startedAt, nowMs)}`}
      className={`${CHIP} ${TONES[tone]}`}
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
 * ⭐ A TAP ENDS IT (2026-11-09, docs/ticket-pill-tap-ends-session.md): *"just end it on tap since that's really what I
 * need to do"*. The trip ends Back at Washbay; the timer ends as its End does; Undo holds for 5 s first. Anything the
 * card would have asked about (a trip under 5 min, an EDV) still opens the card — usePillEnd.
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

  const go = (tab: FocusTab) => {
    hapticLight();
    setMovementTab(tab);
    onNavigate({ name: 'movement-log' });
  };
  const end = usePillEnd((kind: SessionKind) => go(kind === 'trip' ? 'movement-log' : 'off-standard'));

  // Each pill suppresses on its own matching tab — the reminder is redundant
  // when you're already looking at the live session card. A held end or its word stays until it lands.
  const onMovementLog = activeModule === 'movement-log';
  const showTrip = (!!trip || !!end.held.trip || !!end.said.trip) && !(onMovementLog && movementTab === 'movement-log');
  const showOth  = (!!oth  || !!end.held.oth  || !!end.said.oth)  && !(onMovementLog && movementTab === 'off-standard');

  if (!showTrip && !showOth) return null;

  return (
    <div className="flex items-center gap-1.5">
      {showTrip && (trip || end.held.trip || end.said.trip) && (
        <SessionPillButton s={trip ?? GONE.trip} nowMs={nowMs} tone="amber" held={end.held.trip} said={end.said.trip}
          onTap={() => trip && void end.tap('trip', trip)} onUndo={() => end.undo('trip')} />
      )}
      {showOth && (oth || end.held.oth || end.said.oth) && (
        <SessionPillButton s={oth ?? GONE.oth} nowMs={nowMs} tone="teal" held={end.held.oth} said={end.said.oth}
          onTap={() => oth && void end.tap('oth', oth)}
          onUndo={() => end.undo('oth')} />
      )}
    </div>
  );
}

/** A session that has just ended still shows its word ("✓ Saved") for a moment after the poll drops it. */
const GONE: Record<SessionKind, ActiveSession> = {
  trip: { id: '', startedAt: new Date(0).toISOString(), label: 'The trip', emoji: '🚗' },
  oth:  { id: '', startedAt: new Date(0).toISOString(), label: 'The timer', emoji: '⏱' },
};
