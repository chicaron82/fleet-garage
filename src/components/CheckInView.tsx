import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canRelease, deriveRouting } from '../types';
import { MOCK_CHECK_INS } from '../data/checkIns';
import type { VehicleCheckIn } from '../data/checkIns';
import { ReEvalPanel } from './ReEvalPanel';
import { ExceptionReturnSection } from './ExceptionReturnSection';
import { CheckInIntakeForm } from './CheckInIntakeForm';
import {
  generateDayManifest, generateExpectedReturns,
  type ExpectedReturn, type RentalClass,
} from '../data/manifest';
import { loadFlags } from '../lib/manifestFlags';
import { CLASS_INFO } from '../data/classSubstitutions';

interface FlaggedEntry { ret: ExpectedReturn; subFor?: RentalClass; }

function parseResMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function parseReturnStart(expectedTime: string): number {
  const [h, m] = expectedTime.split('–')[0].split(':').map(Number);
  return h * 60 + m;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function daysUntil(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Expiring today';
  return `Expires in ${days}d`;
}

export function CheckInView({ onFlagIssue }: { onFlagIssue: (vehicleId: string) => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'check-in' | 'expected-returns'>('check-in');

  const todayManifest   = useMemo(() => generateDayManifest(), []);
  const expectedReturns = useMemo(() => generateExpectedReturns(), []);
  const flags           = useMemo(() => loadFlags(), []);

  // Cascade: direct class match first; if none, walk acceptable → upgradeOk → stretch
  // and surface the single return closest to the reservation's pickup window.
  const { flaggedReturns, normalReturns } = useMemo(() => {
    const flaggedRes = todayManifest.filter(r => flags.has(r.id));
    const flaggedIds = new Set<string>();
    const entries: FlaggedEntry[] = [];

    for (const reservation of flaggedRes) {
      const cls    = reservation.rentalClass;
      const resMin = parseResMinutes(reservation.time);

      const direct = expectedReturns.filter(r => r.rentalClass === cls && !flaggedIds.has(r.id));
      if (direct.length > 0) {
        direct.forEach(r => { flaggedIds.add(r.id); entries.push({ ret: r }); });
        continue;
      }

      // No direct match — walk substitution chain, pick closest to reservation window
      const info = CLASS_INFO[cls];
      if (!info) continue;
      const chain = [...info.acceptable, ...info.upgradeOk, ...info.stretch];

      for (const alt of chain) {
        const candidates = expectedReturns.filter(r => r.rentalClass === alt && !flaggedIds.has(r.id));
        if (candidates.length === 0) continue;
        const closest = candidates.reduce((best, r) =>
          Math.abs(parseReturnStart(r.expectedTime) - resMin) <
          Math.abs(parseReturnStart(best.expectedTime) - resMin) ? r : best
        );
        flaggedIds.add(closest.id);
        entries.push({ ret: closest, subFor: cls });
        break;
      }
    }

    return {
      flaggedReturns: entries,
      normalReturns:  expectedReturns.filter(r => !flaggedIds.has(r.id)),
    };
  }, [todayManifest, expectedReturns, flags]);

  if (!user) return null;

  const isManagement   = canRelease(user.role);
  const pendingCount   = MOCK_CHECK_INS.filter(c => c.status === 'pending_washbay').length;
  const escalatedCount = MOCK_CHECK_INS.filter(c => c.status === 'escalated').length;
  const cleanCount     = MOCK_CHECK_INS.filter(c => c.status === 'clean').length;
  const pinnedCount    = MOCK_CHECK_INS.filter(c => c.status === 'pinned').length;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Vehicle Check-in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Return inspections · {MOCK_CHECK_INS.length} today
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('check-in')}
          className={`flex-1 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'check-in'
              ? 'bg-yellow-400 dark:bg-yellow-500 text-gray-900'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          Check-in
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expected-returns')}
          className={`flex-1 py-2 text-xs font-semibold transition cursor-pointer relative ${
            activeTab === 'expected-returns'
              ? 'bg-yellow-400 dark:bg-yellow-500 text-gray-900'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          Expected Returns
          {flaggedReturns.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {flaggedReturns.length}
            </span>
          )}
        </button>
      </div>

      {/* Check-in tab */}
      {activeTab === 'check-in' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CountCard count={cleanCount}     label="Clean"     color="text-green-600 dark:text-green-500" />
            <CountCard count={pendingCount}   label="Pending"   color="text-amber-500" />
            <CountCard count={escalatedCount} label="Escalated" color="text-red-600 dark:text-red-500" />
            <CountCard count={pinnedCount}    label="Pinned"    color="text-purple-600 dark:text-purple-500" />
          </div>

          <CheckInIntakeForm onFlagIssue={onFlagIssue} />
          <ExceptionReturnSection />
          <ReEvalPanel />

          {pendingCount > 0 && (user.role === 'VSA' || user.role === 'Lead VSA' || isManagement) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
              <p className="font-semibold">
                {pendingCount} vehicle{pendingCount > 1 ? 's' : ''} awaiting washbay review
              </p>
            </div>
          )}

          <div className="space-y-2">
            {MOCK_CHECK_INS.map(ci => (
              <CheckInCard key={ci.id} checkIn={ci} isManagement={isManagement} />
            ))}
          </div>
        </>
      )}

      {/* Expected Returns tab */}
      {activeTab === 'expected-returns' && (
        <div className="space-y-4">

          {flaggedReturns.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                🚨 Priority Returns — Send to Washbay Immediately
              </p>
              <div className="rounded-xl border border-red-300 dark:border-red-800 overflow-hidden divide-y divide-red-100 dark:divide-red-900/40">
                {flaggedReturns.map(({ ret, subFor }) => (
                  <ExpectedReturnRow key={ret.id} ret={ret} flagged subFor={subFor} />
                ))}
              </div>
            </section>
          )}

          {normalReturns.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Expected Today · {normalReturns.length}
              </p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {normalReturns.map(ret => (
                  <ExpectedReturnRow key={ret.id} ret={ret} flagged={false} />
                ))}
              </div>
            </section>
          )}

          {expectedReturns.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No returns expected today.</p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ExpectedReturnRow({ ret, flagged, subFor }: { ret: ExpectedReturn; flagged: boolean; subFor?: RentalClass }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
      flagged ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
    }`}>
      {flagged && <span className="text-xs shrink-0">🚨</span>}
      <span className={`text-xs font-mono shrink-0 ${
        flagged ? 'text-red-700 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {ret.expectedTime}
      </span>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
        flagged
          ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}>
        {ret.rentalClass}
      </span>
      <span className={`text-xs flex-1 truncate ${
        flagged ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-600 dark:text-gray-400'
      }`}>
        {ret.customerName}
      </span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
        {ret.duration}
      </span>
      {flagged && (
        subFor ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
            🔄 Sub for {subFor}
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 shrink-0">
            ⚡ Washbay
          </span>
        )
      )}
    </div>
  );
}

function CountCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function CheckInCard({ checkIn: ci, isManagement }: { checkIn: VehicleCheckIn; isManagement: boolean }) {
  const routing = deriveRouting(ci.interiorCondition, ci.exteriorCondition);

  const routingBadge = {
    flip:      { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  label: 'Clean' },
    washbay:   { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  label: 'Pending Washbay' },
    review:    { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  label: 'Pending Review' },
    escalated: { bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      label: 'Escalated' },
  }[routing];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">
                {ci.vehicleUnit}
              </span>
              <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">
                {ci.vehiclePlate}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
              Checked in by {ci.checkedInBy} · {fmtTime(ci.checkedInAt)}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <ConditionTag label="Interior" condition={ci.interiorCondition} />
              <ConditionTag label="Exterior" condition={ci.exteriorCondition} />
              <span className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                {ci.photoCount} photo{ci.photoCount !== 1 ? 's' : ''}
              </span>
            </div>
            {ci.notes && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic transition-colors">
                "{ci.notes}"
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${routingBadge.bg} ${routingBadge.text} transition-colors`}>
              {routingBadge.label}
            </span>
            {ci.expiresAt && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 transition-colors">
                {daysUntil(ci.expiresAt)}
              </span>
            )}
            {ci.pinnedBy && (
              <span className="text-[10px] text-purple-500 dark:text-purple-400 transition-colors">
                Pinned by {ci.pinnedBy}
              </span>
            )}
          </div>
        </div>
      </div>

      {ci.washbayReview && (
        <div className={`px-4 py-3 border-t text-xs ${
          ci.washbayReview.result === 'clean'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40 text-red-800 dark:text-red-300'
        } transition-colors`}>
          <p className="font-semibold uppercase tracking-wide mb-1">
            Washbay Review — {REVIEW_LABELS[ci.washbayReview.result]}
          </p>
          <p>
            Reviewed by <span className="font-medium">{ci.washbayReview.reviewedBy}</span>
            {' '}· {fmtTime(ci.washbayReview.reviewedAt)}
          </p>
          {ci.washbayReview.notes && (
            <p className="mt-1 italic opacity-80">"{ci.washbayReview.notes}"</p>
          )}
        </div>
      )}

      {isManagement && ci.status === 'clean' && ci.expiresAt && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 transition-colors">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Auto-expires {ci.expiresAt} · Management can pin to preserve
          </p>
        </div>
      )}
    </div>
  );
}

const REVIEW_LABELS: Record<string, string> = {
  clean: 'Clean',
  too_dirty: 'Too Dirty',
  damage_found: 'Damage Found',
  odour: 'Odour Unfit for Rental',
  pet_hair: 'Pet Hair',
};

function ConditionTag({ label, condition }: { label: string; condition: string }) {
  const colors =
    condition === 'clean'        ? 'text-green-600 dark:text-green-400' :
    condition === 'good'         ? 'text-blue-600 dark:text-blue-400' :
    condition === 'questionable' ? 'text-amber-600 dark:text-amber-400' :
                                   'text-red-600 dark:text-red-400';
  return (
    <span className={`text-xs ${colors} transition-colors`}>
      {label}: <span className="font-medium capitalize">{condition}</span>
    </span>
  );
}
