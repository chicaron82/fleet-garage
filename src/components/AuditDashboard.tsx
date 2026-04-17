import { MOCK_AUDITS } from '../data/mock-audits';
import type { AuditRecord } from '../types';

interface Props {
  onNewAudit: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

function failCount(audit: AuditRecord): number {
  return audit.sections.flatMap(s => s.items).filter(i => i.result === 'fail').length;
}

export function AuditDashboard({ onNewAudit }: Props) {
  const passed = MOCK_AUDITS.filter(a => a.status === 'PASSED').length;
  const failed = MOCK_AUDITS.filter(a => a.status === 'FAILED').length;
  const total  = MOCK_AUDITS.length;
  const passRate = Math.round((passed / total) * 100);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Audits</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {total} total · <span className="text-green-600 dark:text-green-400">{passed} passed</span> · <span className="text-red-500 dark:text-red-400">{failed} failed</span>
          </p>
          {/* Pass rate bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                style={{ width: `${passRate}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">{passRate}%</span>
          </div>
        </div>
        <button
          onClick={onNewAudit}
          className="w-10 h-10 bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400 rounded-xl flex items-center justify-center text-black font-bold text-xl transition cursor-pointer shadow-sm shrink-0"
          aria-label="New audit"
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {[...MOCK_AUDITS].sort((a, b) => b.date.localeCompare(a.date)).map(audit => (
          <AuditCard key={audit.id} audit={audit} />
        ))}
      </div>
    </div>
  );
}

function AuditCard({ audit }: { audit: AuditRecord }) {
  const fails = failCount(audit);
  const isPassed = audit.status === 'PASSED';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{audit.vehicleNumber}</span>
            <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{audit.plate}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {audit.owningArea} · {fmtDate(audit.date)} at {fmtTime(audit.date)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Auditor: {audit.auditorName} · Driver: {audit.crew.driverSide}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
            isPassed
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            {isPassed ? '✅ Passed' : `❌ Failed`}
          </span>
          {!isPassed && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fails} item{fails !== 1 ? 's' : ''} failed</p>
          )}
        </div>
      </div>
    </div>
  );
}
