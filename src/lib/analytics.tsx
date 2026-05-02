// Shared constants, demo data, and micro-components for AnalyticsDashboard

export const COMPANY_STANDARD = 3.0;

export function canEnterFleetBalance(role: string): boolean {
  return ['Branch Manager', 'Operations Manager', 'Lead VSA'].includes(role);
}

// ── Demo data ─────────────────────────────────────────────────────────────────

export const DEMO_HOLD_TYPES = [
  { label: 'Damage',     count: 14, color: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-400' },
  { label: 'Detail',     count: 6,  color: 'bg-teal-400',   text: 'text-teal-700 dark:text-teal-400' },
  { label: 'Mechanical', count: 5,  color: 'bg-blue-400',   text: 'text-blue-700 dark:text-blue-400' },
];

export const DEMO_DAMAGE_TYPES = [
  { label: 'Scratch — paint surface',       count: 8 },
  { label: 'Windshield chip',               count: 5 },
  { label: 'Bumper damage — cosmetic',      count: 4 },
  { label: 'Scratch — to bare metal',       count: 3 },
  { label: 'Rim / hubcap damage',           count: 2 },
  { label: 'Dent — minor (no paint break)', count: 2 },
];

export const DEMO_WEEK_ACTIVITY = [
  { day: 'Mon', holds: 3, releases: 1 },
  { day: 'Tue', holds: 2, releases: 2 },
  { day: 'Wed', holds: 5, releases: 1 },
  { day: 'Thu', holds: 1, releases: 3 },
  { day: 'Fri', holds: 4, releases: 2 },
  { day: 'Sat', holds: 2, releases: 0 },
  { day: 'Sun', holds: 1, releases: 1 },
];

export const DEMO_GLANCE = { activeHolds: 25, onException: 8, returnedThisWeek: 3 };

export const DEMO_EXCEPTION_SUMMARY = [
  { reason: 'Management decision — operational need', count: 4 },
  { reason: 'Damage documented — vehicle serviceable', count: 2 },
  { reason: 'Awaiting parts — vehicle cleared for limited use', count: 1 },
  { reason: 'Customer accepted known damage', count: 1 },
];

export const DEMO_WASHBAY_TODAY = {
  carsIn: 64, carsCleaned: 57, throughput: 7.1,
  heldToday: 8, rentablesProcessed: 56, cleanNotPickedUp: 7, deliveredToAirport: 49,
  teamSize: 3, openingCarsOut: 50, netFlow: 14,
};

const DEMO_WASHBAY_HISTORY = [
  { throughput: 8.5 }, { throughput: 7.1 }, { throughput: 9.2 }, { throughput: 7.8 },
  { throughput: 8.0 }, { throughput: 10.1 }, { throughput: 7.4 }, { throughput: 8.8 },
  { throughput: 9.0 }, { throughput: 7.5 }, { throughput: 8.3 }, { throughput: 9.6 },
  { throughput: 7.2 }, { throughput: 8.1 },
];
export const DEMO_WASHBAY_30DAY_AVG = Math.round(
  (DEMO_WASHBAY_HISTORY.reduce((s, d) => s + d.throughput, 0) / DEMO_WASHBAY_HISTORY.length) * 10
) / 10;

// ── Shared micro-components ───────────────────────────────────────────────────

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
