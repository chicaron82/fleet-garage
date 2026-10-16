// Today's crew, editable, in FG's Lot Lookout module. Aaron, 2026-10-15: *"On my view it's editable. If VSA's are
// pulled. 2 buttons ALL, SELECTED. ALL selects all VSA to pull to move cars ... If someone is sick. Crossed off. Could
// work for drivers too."* Names fill in from today's schedule; he taps only what changed. Tapping a person's current
// state again puts them back to what the schedule says. Tapping someone whose shift is over means they stayed late.
//
// Polish, the same night (21:03): *"i'm thinking of removing those who's shift window has passed. and removing Larry
// C from being displayed as a driver"*. Finished shifts fold into "N finished ▾" (still reachable, so a stayed-late
// tap is one fold away), and anyone can be left off the line, remembered across days (migration 155).
import { useState } from 'react';
import { CREW_STATES, CREW_STATE_LABEL, splitFinished, type CrewMember, type CrewRole, type CrewState } from '../../lib/lotCrew';

interface Props {
  members: CrewMember[];
  mark: (users: string[], state: CrewState | 'clear') => Promise<string | null>;
  toast: (msg: string) => void;
  /** Who is left off the line, and the switch. Absent = the panel offers no leave-off (older callers). */
  leftOff?: { userId: string; name: string }[];
  leaveOff?: (user: string, off: boolean) => Promise<string | null>;
}

const SECTION: Record<CrewRole, { title: string; pull: CrewState; back: CrewState; pullLabel: string; backLabel: string }> = {
  vsa: { title: 'VSAs', pull: 'moving', back: 'cleaning', pullLabel: 'All to moving cars', backLabel: 'All back to cleaning' },
  driver: { title: 'Drivers', pull: 'other', back: 'airport', pullLabel: 'All to another job', backLabel: 'All back to the airport' },
};

function when(m: CrewMember): string {
  const times = m.start && m.end ? `${m.start}–${m.end}` : '';
  if (m.phase === 'later') return `${times} · later`;
  if (m.phase === 'done') return `${times} · done`;
  return times;
}

const chip = 'rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50';
const link = 'text-xs font-semibold text-gray-600 dark:text-gray-300 underline underline-offset-2 cursor-pointer disabled:opacity-50';

export function LotCrewPanel({ members, mark, toast, leftOff, leaveOff }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showFinished, setShowFinished] = useState<Set<CrewRole>>(new Set());
  const [editOff, setEditOff] = useState(false);

  const run = async (users: string[], state: CrewState | 'clear', done: string) => {
    if (users.length === 0) return;
    setBusy(true);
    const problem = await mark(users, state);
    setBusy(false);
    if (problem) { toast(problem); return; }
    setChecked(new Set());
    toast(done);
  };

  const setOff = async (user: string, name: string, off: boolean) => {
    if (!leaveOff) return;
    setBusy(true);
    const problem = await leaveOff(user, off);
    setBusy(false);
    toast(problem ?? (off ? `${name} left off the crew line` : `${name} back on the crew line`));
  };

  const toggleCheck = (id: string) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const row = (m: CrewMember, role: CrewRole) => (
    <li key={m.userId} className={`py-1.5 space-y-1 ${m.onNow ? '' : 'opacity-60'}`}>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked.has(m.userId)} onChange={() => toggleCheck(m.userId)} className="h-4 w-4" />
        <span className={`font-semibold ${m.state === 'out' ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>{m.name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{when(m)}</span>
      </label>
      <div className="flex gap-1.5 pl-6" role="group" aria-label={`${m.name}: ${CREW_STATE_LABEL[m.state]}`}>
        {CREW_STATES[role].map(st => {
          const on = m.state === st;
          return (
            <button key={st} type="button" disabled={busy} aria-pressed={on}
              onClick={() => void run([m.userId], on ? 'clear' : st, on ? `${m.name}: back to the schedule` : `${m.name}: ${CREW_STATE_LABEL[st].toLowerCase()}`)}
              className={`${chip} ${on ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
              {CREW_STATE_LABEL[st]}
            </button>
          );
        })}
      </div>
    </li>
  );

  return (
    <div className="space-y-3">
      {(['vsa', 'driver'] as const).map(role => {
        const list = members.filter(m => m.role === role);
        if (list.length === 0) return null;
        const sec = SECTION[role];
        const { current, finished } = splitFinished(list);
        const open = showFinished.has(role);
        const working = list.filter(m => m.onNow && m.state !== 'out');
        const allPulled = working.length > 0 && working.every(m => m.state === sec.pull);
        const picked = list.filter(m => checked.has(m.userId)).map(m => m.userId);
        return (
          <section key={role} aria-label={sec.title} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{sec.title}</h3>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy || working.length === 0}
                  onClick={() => void run(working.map(m => m.userId), allPulled ? sec.back : sec.pull, allPulled ? sec.backLabel : sec.pullLabel)}
                  className={`${chip} border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100`}>
                  {allPulled ? sec.backLabel : sec.pullLabel}
                </button>
                <button type="button" disabled={busy || picked.length === 0}
                  onClick={() => void run(picked, sec.pull, `${picked.length} sent: ${CREW_STATE_LABEL[sec.pull].toLowerCase()}`)}
                  className={`${chip} border-fg-yellow bg-fg-yellow text-black`}>
                  Send {picked.length || ''} checked
                </button>
              </div>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {current.map(m => row(m, role))}
              {open && finished.map(m => row(m, role))}
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
