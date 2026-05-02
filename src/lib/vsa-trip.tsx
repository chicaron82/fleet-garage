import { hapticLight } from './haptics';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Reason         = 'ROUTINE' | 'COVERAGE_ASSIST' | 'CODE_RED' | 'OTHER';
export type Authorization  = 'MANAGEMENT' | 'LEAD_VSA' | 'PERSONAL';
export type QueueSnapshot  = '0' | '~5' | 'TOO_MUCH';
export type FuelLevel      = number;
export type TripState      = 'form' | 'in_transit' | 'complete';

// ── Constants ─────────────────────────────────────────────────────────────────

export const FUEL_LABELS: Record<number, string> = {
  0: 'Empty', 1: '1/8', 2: '1/4', 3: '3/8',
  4: '1/2',  5: '5/8', 6: '3/4', 7: '7/8', 8: 'Full',
};

export const REASON_LABELS: Record<Reason, string> = {
  ROUTINE:          'Routine Transport',
  COVERAGE_ASSIST:  'Coverage Assist',
  CODE_RED:         'Code Red',
  OTHER:            'Other',
};

// ── Pure helpers ───────────────────────────────────────────────────────────────

export function fuelColor(v: number): string {
  if (v <= 1) return '#ef4444';
  if (v <= 2) return '#f97316';
  if (v <= 3) return '#eab308';
  return '#22c55e';
}

export function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

// ── Shared sub-components ──────────────────────────────────────────────────────

export function Pill({ label, active, danger, onClick }: {
  label: string; active: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { hapticLight(); onClick(); }}
      className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
        active
          ? danger
            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

export function NotesField({ value, onChange, tripState }: {
  value: string; onChange: (v: string) => void; tripState: TripState;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        {tripState === 'form' ? 'Notes' : 'Context / Delays'}
      </label>
      <textarea
        value={value}
        onChange={e => {
          onChange(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        placeholder={tripState === 'form' ? 'Any context for this run…' : 'Stuck behind a train? Let us know…'}
        rows={1}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none overflow-hidden"
      />
    </div>
  );
}
