import { useReEval } from '../hooks/useReEval';
import { DETAIL_REASON_LABELS } from '../types';
import type { ReEvalItem } from '../hooks/useReEval';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function ReEvalPanel() {
  const re = useReEval();
  if (re.count === 0) return null;

  const outCount = re.items.filter(i => i.vehicle.status === 'OUT_ON_EXCEPTION').length;
  const returnedCount = re.items.filter(i => i.vehicle.status === 'RETURNED').length;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700/50 rounded-xl px-4 py-3 transition-colors">
        <p className="font-semibold text-sm text-teal-800 dark:text-teal-300">
          Exception Returns — {re.count} vehicle{re.count > 1 ? 's' : ''} for re-evaluation
        </p>
        <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
          {outCount > 0 && `${outCount} still out`}
          {outCount > 0 && returnedCount > 0 && ' · '}
          {returnedCount > 0 && `${returnedCount} returned`}
        </p>
      </div>

      {/* Cards */}
      {re.items.map(item => (
        <ReEvalCard key={item.hold.id} item={item} re={re} />
      ))}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

type ReHook = ReturnType<typeof useReEval>;

function ReEvalCard({ item, re }: { item: ReEvalItem; re: ReHook }) {
  const { hold, vehicle } = item;
  const isActive = re.activeHoldId === hold.id;
  const isOut = vehicle.status === 'OUT_ON_EXCEPTION';
  const reasonLabel = hold.detailReason ? DETAIL_REASON_LABELS[hold.detailReason] : 'Unknown';
  const actions = hold.detailReason ? re.getActions(hold.detailReason) : [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-teal-200 dark:border-teal-800/50 overflow-hidden transition-colors">
      <div className="p-4">
        {/* Vehicle info */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">
                {vehicle.unitNumber}
              </span>
              <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">
                {vehicle.licensePlate}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            isOut
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {isOut ? 'Out on Exception' : 'Returned'}
          </span>
        </div>

        {/* Hold context */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-950 rounded-lg px-3 py-2.5 space-y-1 transition-colors">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              hold.detailReason === 'pet-hair'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            } transition-colors`}>
              {reasonLabel}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Flagged {fmtDate(hold.flaggedAt)} by {re.getName(hold.flaggedById)}
            </span>
          </div>
          {hold.release && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Released {fmtDate(hold.release.approvedAt)} · {hold.release.reason}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isActive && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {isOut ? (
              <button
                onClick={() => { re.setActiveHoldId(hold.id); re.setActiveAction('confirm-return'); }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Confirm Return
              </button>
            ) : (
              <>
                {actions.includes('clear') && (
                  <button
                    onClick={() => { re.setActiveHoldId(hold.id); re.setActiveAction('clear'); }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Clear — Issue Resolved
                  </button>
                )}
                {actions.includes('re-hold') && (
                  <button
                    onClick={() => { re.setActiveHoldId(hold.id); re.setActiveAction('re-hold'); }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Re-hold — Issue Persists
                  </button>
                )}
                {actions.includes('escalate') && (
                  <button
                    onClick={() => { re.setActiveHoldId(hold.id); re.setActiveAction('escalate'); }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Escalate to Management
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmation panels */}
      {isActive && re.activeAction === 'confirm-return' && (
        <ConfirmPanel
          title="Confirm Vehicle Return"
          description="This marks the vehicle as returned from its exception rental. You can then re-evaluate the original hold."
          color="teal"
          confirmLabel={re.processing ? 'Saving...' : 'Confirm Return'}
          processing={re.processing}
          onConfirm={() => re.confirmReturn(hold.id)}
          onCancel={() => { re.setActiveHoldId(null); re.setActiveAction(null); }}
        />
      )}

      {isActive && re.activeAction === 'clear' && (
        <ConfirmPanel
          title="Clear Vehicle"
          description={`The ${reasonLabel.toLowerCase()} issue is no longer present. Vehicle returns to regular circulation.`}
          color="green"
          confirmLabel={re.processing ? 'Saving...' : 'Confirm Clear'}
          processing={re.processing}
          notes={re.notes}
          onNotesChange={re.setNotes}
          onConfirm={() => re.clearHold(hold.id)}
          onCancel={() => { re.setActiveHoldId(null); re.setActiveAction(null); re.setNotes(''); }}
        />
      )}

      {isActive && (re.activeAction === 're-hold' || re.activeAction === 'escalate') && (
        <ConfirmPanel
          title={re.activeAction === 'escalate' ? 'Escalate to Management' : 'Re-hold Vehicle'}
          description={
            re.activeAction === 'escalate'
              ? `Pet hair requires management authorization. A new hold will be created for review.`
              : `The ${reasonLabel.toLowerCase()} issue persists. A new hold will be created for management review.`
          }
          color={re.activeAction === 'escalate' ? 'red' : 'amber'}
          confirmLabel={re.processing ? 'Saving...' : re.activeAction === 'escalate' ? 'Confirm Escalation' : 'Confirm Re-hold'}
          processing={re.processing}
          notes={re.notes}
          onNotesChange={re.setNotes}
          onConfirm={() => re.reHoldVehicle(hold.id)}
          onCancel={() => { re.setActiveHoldId(null); re.setActiveAction(null); re.setNotes(''); }}
        />
      )}
    </div>
  );
}

// ── Confirmation panel ───────────────────────────────────────────────────────

const COLOR_MAP = {
  teal:  { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800/40', heading: 'text-teal-800 dark:text-teal-300', text: 'text-teal-900 dark:text-teal-200', cancelBorder: 'border-teal-300 dark:border-teal-700', cancelText: 'text-teal-700 dark:text-teal-400', cancelHover: 'hover:bg-teal-100 dark:hover:bg-teal-900/40', btn: 'bg-teal-600 hover:bg-teal-500' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/40', heading: 'text-green-800 dark:text-green-300', text: 'text-green-900 dark:text-green-200', cancelBorder: 'border-green-300 dark:border-green-700', cancelText: 'text-green-700 dark:text-green-400', cancelHover: 'hover:bg-green-100 dark:hover:bg-green-900/40', btn: 'bg-green-600 hover:bg-green-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/40', heading: 'text-amber-800 dark:text-amber-300', text: 'text-amber-900 dark:text-amber-200', cancelBorder: 'border-amber-300 dark:border-amber-700', cancelText: 'text-amber-700 dark:text-amber-400', cancelHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/40', btn: 'bg-amber-500 hover:bg-amber-400' },
  red:   { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/40', heading: 'text-red-800 dark:text-red-300', text: 'text-red-900 dark:text-red-200', cancelBorder: 'border-red-300 dark:border-red-700', cancelText: 'text-red-700 dark:text-red-400', cancelHover: 'hover:bg-red-100 dark:hover:bg-red-900/40', btn: 'bg-red-600 hover:bg-red-500' },
} as const;

interface ConfirmPanelProps {
  title: string;
  description: string;
  color: keyof typeof COLOR_MAP;
  confirmLabel: string;
  processing: boolean;
  notes?: string;
  onNotesChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmPanel({ title, description, color, confirmLabel, processing, notes, onNotesChange, onConfirm, onCancel }: ConfirmPanelProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={`${c.bg} border-t ${c.border} px-4 py-4 space-y-3 transition-colors`}>
      <h3 className={`text-xs font-semibold ${c.heading} uppercase tracking-widest`}>{title}</h3>
      <p className={`text-sm ${c.text}`}>{description}</p>
      {onNotesChange && (
        <textarea
          rows={2}
          placeholder="Notes (optional)"
          value={notes ?? ''}
          onChange={e => onNotesChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`flex-1 py-2.5 border ${c.cancelBorder} ${c.cancelText} font-medium text-sm rounded-lg ${c.cancelHover} transition cursor-pointer`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={processing}
          onClick={onConfirm}
          className={`flex-1 py-2.5 ${c.btn} disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
