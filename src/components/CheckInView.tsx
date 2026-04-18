import { useAuth } from '../context/AuthContext';
import { canRelease } from '../types';
import { MOCK_CHECK_INS } from '../data/checkIns';
import type { CheckInStatus, VehicleCheckIn } from '../data/checkIns';
import { ReEvalPanel } from './ReEvalPanel';
import { ExceptionReturnSection } from './ExceptionReturnSection';
import { CheckInIntakeForm } from './CheckInIntakeForm';

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

const STATUS_CONFIG: Record<CheckInStatus, { bg: string; text: string; label: string }> = {
  clean:           { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  label: 'Clean' },
  pending_washbay: { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  label: 'Pending Washbay' },
  escalated:       { bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      label: 'Escalated' },
  pinned:          { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Pinned' },
};

export function CheckInView({ onFlagIssue }: { onFlagIssue: (vehicleId: string) => void }) {
  const { user } = useAuth();
  if (!user) return null;

  const isManagement = canRelease(user.role);

  const pendingCount = MOCK_CHECK_INS.filter(c => c.status === 'pending_washbay').length;
  const escalatedCount = MOCK_CHECK_INS.filter(c => c.status === 'escalated').length;
  const cleanCount = MOCK_CHECK_INS.filter(c => c.status === 'clean').length;
  const pinnedCount = MOCK_CHECK_INS.filter(c => c.status === 'pinned').length;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Vehicle Check-in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Return inspections · {MOCK_CHECK_INS.length} today
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CountCard count={cleanCount} label="Clean" color="text-green-600 dark:text-green-500" />
        <CountCard count={pendingCount} label="Pending" color="text-amber-500" />
        <CountCard count={escalatedCount} label="Escalated" color="text-red-600 dark:text-red-500" />
        <CountCard count={pinnedCount} label="Pinned" color="text-purple-600 dark:text-purple-500" />
      </div>

      {/* Vehicle intake: scan a real vehicle to begin check-in */}
      <CheckInIntakeForm onFlagIssue={onFlagIssue} />

      {/* Exception returns: damage-hold vehicles back from exception rental */}
      <ExceptionReturnSection />

      {/* Re-evaluation: detail-hold vehicles (pet-hair / smoke / dirty) */}
      <ReEvalPanel />

      {/* Pending washbay alert */}
      {pendingCount > 0 && (user.role === 'VSA' || user.role === 'Lead VSA' || isManagement) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
          <p className="font-semibold">
            {pendingCount} vehicle{pendingCount > 1 ? 's' : ''} awaiting washbay review
          </p>
        </div>
      )}

      {/* Check-in list */}
      <div className="space-y-2">
        {MOCK_CHECK_INS.map(ci => (
          <CheckInCard key={ci.id} checkIn={ci} isManagement={isManagement} />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CountCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function CheckInCard({ checkIn: ci, isManagement }: { checkIn: VehicleCheckIn; isManagement: boolean }) {
  const style = STATUS_CONFIG[ci.status];

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
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} transition-colors`}>
              {style.label}
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

      {/* Washbay review footer */}
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

      {/* Management actions hint */}
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
  const colors = condition === 'clean'
    ? 'text-green-600 dark:text-green-400'
    : condition === 'questionable'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <span className={`text-xs ${colors} transition-colors`}>
      {label}: <span className="font-medium capitalize">{condition}</span>
    </span>
  );
}
