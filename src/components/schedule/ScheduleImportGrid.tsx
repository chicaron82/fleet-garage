// The verify grid for a parsed schedule (Phase 1). Read-only cells (the human eyeballs
// them against the photo); the only editable bit is the per-row name → roster assignment,
// since name-matching is the fuzzy part. Cell editing + the write are Phase 2.
import type { ParsedSchedule, ParsedShiftType, RosterProfile } from '../../../api/_lib/scheduleParse';

const TYPE_STYLE: Record<ParsedShiftType, string> = {
  opening: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  mid: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  closing: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'day-off': 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400',
  pto: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  sick: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  unknown: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300 dark:bg-orange-500/20 dark:text-orange-300',
};
const TYPE_LABEL: Record<ParsedShiftType, string> = {
  opening: 'Open', mid: 'Mid', closing: 'Close', 'day-off': 'Off', pto: 'PTO', sick: 'Sick', unknown: '?',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

interface Props {
  schedule: ParsedSchedule;
  roster: RosterProfile[];
  assignments: (string | null)[];
  types: ParsedShiftType[][]; // effective type per cell (parse + edits)
  onAssign: (rowIndex: number, profileId: string | null) => void;
  onCycleCell: (rowIndex: number, cellIndex: number) => void;
}

export function ScheduleImportGrid({ schedule, roster, assignments, types, onAssign, onCycleCell }: Props) {
  const dates = schedule.staff[0]?.cells.map((c) => c.date) ?? [];

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Staff
            </th>
            {dates.map((d, i) => (
              <th key={i} className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-300">{fmtDate(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.staff.map((row, ri) => {
            const unmatched = !assignments[ri];
            return (
              <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 dark:bg-gray-900">
                  <select
                    value={assignments[ri] ?? ''}
                    onChange={(e) => onAssign(ri, e.target.value || null)}
                    title={`Read as "${row.name}"`}
                    className={`w-full max-w-[9rem] rounded border bg-transparent px-1 py-0.5 text-xs ${
                      unmatched
                        ? 'border-rose-400 text-rose-600 dark:text-rose-400'
                        : 'border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-200'
                    }`}
                  >
                    <option value="">⚠ {row.name} — assign…</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                {row.cells.map((c, ci) => {
                  const t = types[ri]?.[ci] ?? c.type;
                  const times = c.startTime ? `${c.startTime}–${c.endTime ?? ''}` : '';
                  return (
                    <td key={ci} className="px-0.5 py-0.5 text-center">
                      <button
                        onClick={() => onCycleCell(ri, ci)}
                        title={`${c.raw || c.type}${times ? ` (${times})` : ''} — tap to change`}
                        className={`block w-full min-w-[3.2rem] cursor-pointer rounded px-1 py-0.5 ${TYPE_STYLE[t]}`}
                      >
                        <span className="block leading-tight">{TYPE_LABEL[t]}</span>
                        {times && <span className="block text-[9px] leading-none opacity-70">{c.startTime}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
