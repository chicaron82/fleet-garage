import { useState } from 'react';
import { elapsedLabel } from '../../lib/activeSessions';
import type { ActiveSession } from '../../context/ActiveSessionsContext';

/**
 * Heads-up shown when you try to start a session while another is already
 * running. Names the running session + how long it's been going, and offers two
 * deliberate choices — go end the old one, or start anyway (double-run). Shared
 * by the trip-start and off-standard-start flows.
 */
export function SessionCollisionGuard({ other, onGoEnd, onProceed }: {
  other:     ActiveSession;
  onGoEnd:   () => void;
  onProceed: () => void;
}) {
  // Snapshot "now" at mount — a transient confirm doesn't need to tick, and a
  // pure render can't call Date.now() directly.
  const [shownAt] = useState(() => Date.now());
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800/50 rounded-lg px-4 py-3 space-y-3">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
        {other.emoji} {other.label} still running from {elapsedLabel(other.startedAt, shownAt)} ago — end it first?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onGoEnd}
          className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition cursor-pointer"
        >
          End the old one
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold transition cursor-pointer"
        >
          Start anyway
        </button>
      </div>
    </div>
  );
}
