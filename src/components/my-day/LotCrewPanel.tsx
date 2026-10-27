// Today's crew, named, in FG's Lot Lookout module: who is scheduled, from the schedule alone.
//
// ⭐ 2026-10-24, Aaron: *"The who's running feature is too scope-y. Keeping track is too much. Let's just simply it. So
// who's on just shows who's scheduled (regardless if I've marked present or not)"*. The job chips (cleaning / moving
// cars, airport / another job) and the "All to …" / "Send checked" buttons are gone; nothing here needs a tap to stay
// true. Ticket: docs/ticket-crew-line-is-the-schedule.md.
//
// Kept from 2026-10-15 (21:03): *"i'm thinking of removing those who's shift window has passed. and removing Larry C
// from being displayed as a driver"*. Finished shifts fold into "N finished ▾", and anyone can be left off the line,
// remembered across days (migration 155).
import { useState } from 'react';
import { splitFinished, type CrewMember, type CrewRole } from '../../lib/lotCrew';

interface Props {
  members: CrewMember[];
  toast: (msg: string) => void;
  /** Who is left off the line, and the switch. Absent = the panel offers no leave-off. */
  leftOff?: { userId: string; name: string }[];
  leaveOff?: (user: string, off: boolean) => Promise<string | null>;
}

const TITLE: Record<CrewRole, string> = { vsa: 'VSAs', driver: 'Drivers' };

function when(m: CrewMember): string {
  if (m.out) return 'out';
  // The [+] hours ride along: "06:45–15:15 +17:00–21:00" (asked back the same day).
  const times = [m.start && m.end ? `${m.start}–${m.end}` : '', ...(m.more ?? []).map(b => `+${b.start}–${b.end}`)]
    .filter(Boolean).join(' ');
  if (m.phase === 'later') return `${times} · later`;
  if (m.phase === 'done') return `${times} · done`;
  return times;
}

const chip = 'rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50';
const link = 'text-xs font-semibold text-gray-600 dark:text-gray-300 underline underline-offset-2 cursor-pointer disabled:opacity-50';

export function LotCrewPanel({ members, toast, leftOff, leaveOff }: Props) {
  const [busy, setBusy] = useState(false);
  const [showFinished, setShowFinished] = useState<Set<CrewRole>>(new Set());
  const [editOff, setEditOff] = useState(false);

  const setOff = async (user: string, name: string, off: boolean) => {
    if (!leaveOff) return;
    setBusy(true);
    const problem = await leaveOff(user, off);
    setBusy(false);
    toast(problem ?? (off ? `${name} left off the crew line` : `${name} back on the crew line`));
  };

  const row = (m: CrewMember) => (
    <li key={m.userId} className={`py-1.5 flex items-center gap-2 text-sm ${m.onNow ? '' : 'opacity-60'}`}>
      <span className={`font-semibold ${m.out ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>{m.name}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{when(m)}</span>
    </li>
  );

  return (
    <div className="space-y-3">
      {(['vsa', 'driver'] as const).map(role => {
        const list = members.filter(m => m.role === role);
        if (list.length === 0) return null;
        const { current, finished } = splitFinished(list);
        const open = showFinished.has(role);
        return (
          <section key={role} aria-label={TITLE[role]} className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{TITLE[role]}</h3>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {current.map(row)}
              {open && finished.map(row)}
            </ul>
            {finished.length > 0 && (
              <button type="button" aria-expanded={open} className={link}
                onClick={() => setShowFinished(prev => { const n = new Set(prev); if (n.has(role)) n.delete(role); else n.add(role); return n; })}>
                {open ? 'Hide finished ▴' : `${finished.length} finished ▾`}
              </button>
            )}
          </section>
        );
      })}

      {leaveOff && (
        <section aria-label="Left off the crew line" className="space-y-1.5 border-t border-gray-200 dark:border-gray-700 pt-2">
          <button type="button" aria-expanded={editOff} onClick={() => setEditOff(o => !o)} className={link}>
            {editOff ? 'Done ▴' : `Leave someone off the crew line ▾${leftOff?.length ? ` (${leftOff.length} left off)` : ''}`}
          </button>
          {editOff && (
            <ul className="space-y-1">
              {members.map(m => (
                <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span>{m.name}</span>
                  <button type="button" disabled={busy} onClick={() => void setOff(m.userId, m.name, true)}
                    className={`${chip} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200`}>Leave off</button>
                </li>
              ))}
              {(leftOff ?? []).map(p => (
                <li key={p.userId} className="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{p.name} · left off</span>
                  <button type="button" disabled={busy} onClick={() => void setOff(p.userId, p.name, false)}
                    className={`${chip} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200`}>Bring back</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
