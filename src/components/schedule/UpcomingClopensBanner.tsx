import { useMyUpcomingClopens } from '../../hooks/useMyUpcomingClopens';
import { clopenLabel } from '../../lib/scheduleClopens';
import { toISO } from '../../context/ScheduleContext';

// The standing clopen heads-up on the Schedule screen: every clopen coming up in your
// loaded schedule, read from the stored shifts (no re-upload). Renders nothing when you
// have none. Today-aware — a clopen that starts today reads "Today → tomorrow" under a
// "Clopen today" header, not "coming up". My Day stays lean; this is the full picture.
export function UpcomingClopensBanner({ userId }: { userId: string | undefined }) {
  const clopens = useMyUpcomingClopens(userId);
  if (clopens.length === 0) return null;

  const todayISO = toISO(new Date());
  const n = clopens.length;
  const startsToday = clopens.some((c) => c.closeDate === todayISO);
  const header = startsToday
    ? (n === 1 ? '🔁 Clopen today — short turnaround' : `🔁 Clopen today · ${n - 1} more coming up`)
    : `🔁 ${n} clopen${n === 1 ? '' : 's'} coming up in your schedule`;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-900/15">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{header}:</p>
      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
        {clopens.map((c) => clopenLabel(c, todayISO)).join('  ·  ')}
      </p>
      <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-500/70">Closing then opening the next day — flag it with the boss or brace for it.</p>
    </div>
  );
}
