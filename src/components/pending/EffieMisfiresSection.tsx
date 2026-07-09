// "Where Effie misfires" — the payoff half of the correction loop
// (docs/ticket-misc-effie-correction-loop.md). Groups the reasons operators tagged when
// rejecting Effie's staged writes into the pattern worth acting on: read misfires (each
// pointing at a tuning lever — class codex / plate prefix / prompt) up top, valid
// non-misread rejects (duplicate / not needed) muted below. Read-only: it surfaces the
// signal so a human decides the fix; nothing here auto-tunes. Self-hides when empty.
import { useState } from 'react';
import { useEffieMisfires } from '../../hooks/useEffieMisfires';
import { summarizeMisfires } from '../../lib/summarizeMisfires';

export function EffieMisfiresSection() {
  const { reasonIds } = useEffieMisfires();
  const [collapsed, setCollapsed] = useState(true);
  const { misfires, other, misfireTotal } = summarizeMisfires(reasonIds);

  if (misfires.length === 0 && other.length === 0) return null;
  const open = !collapsed;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Effie — where she misfires</span>
          {misfireTotal > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {misfireTotal}
            </span>
          )}
        </div>
        <span className="text-xs text-amber-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-amber-200 dark:border-amber-800/40 px-4 py-3 space-y-2.5">
          {misfires.length > 0 ? (
            <ul className="space-y-1.5">
              {misfires.map(m => (
                <li key={m.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-gray-800 dark:text-gray-100">
                    {m.label} <span className="text-gray-400 dark:text-gray-500">×{m.count}</span>
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 shrink-0">→ {m.tunes}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No read misfires — just non-misread rejects below.</p>
          )}

          {other.length > 0 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1 border-t border-amber-200/60 dark:border-amber-800/30">
              Not misreads: {other.map(o => `${o.label} ×${o.count}`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
