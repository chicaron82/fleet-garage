import { fmtDateShift, type SavedSummary } from './shiftSummaryUtils';

// ── Generic analytics primitives ─────────────────────────────────────────────

export function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
      {title}
    </h2>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">{message}</p>
  );
}

// ── ShiftSummarySection display components ────────────────────────────────────

function fmtMinutes(mins: number): string {
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

export function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {sub}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0">{value}</p>
    </div>
  );
}

export function ShiftSparkline({ history }: { history: SavedSummary[] }) {
  const points = [...history].reverse();
  if (points.length < 2) return null;

  const values = points.map(s => s.offStandardMinutes);
  const max    = Math.max(...values, 1);
  const min    = Math.min(...values);
  const range  = max - min || 1;

  const W = 80; const H = 24; const PAD = 3;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const coords = points.map((s, i) => ({
    x: PAD + (i / (points.length - 1)) * plotW,
    y: PAD + (1 - (s.offStandardMinutes - min) / range) * plotH,
  }));

  const polyline = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last     = coords[coords.length - 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
      <polyline
        points={polyline}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-amber-400 dark:stroke-amber-500"
      />
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="2.5" className="fill-amber-500 dark:fill-amber-400" />
    </svg>
  );
}

export function HistoryCard({ s, onExportClick }: { s: SavedSummary; onExportClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onExportClick}
      disabled={!onExportClick}
      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer disabled:cursor-default"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtDateShift(s.date)}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">Saved {fmtTime(s.savedAt)}</p>
          {onExportClick && <span className="text-xs text-gray-400 dark:text-gray-500">↗</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>⏱ {fmtMinutes(s.offStandardMinutes)}</span>
        {s.tripCount > 0 && <span>🚗 {s.tripCount} trip{s.tripCount !== 1 ? 's' : ''} · {fmtMinutes(s.tripMinutes)}</span>}
        {s.holdsFlagged > 0 && <span>🚨 {s.holdsFlagged} unit{s.holdsFlagged !== 1 ? 's' : ''} flagged</span>}
      </div>
    </button>
  );
}
