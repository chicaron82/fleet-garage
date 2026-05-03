import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { MOCK_AUDITS } from '../data/mock-audits';
import { AUDIT_POSITION_LABELS } from '../types';
import type { AuditRecord, AuditCrewMember } from '../types';

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

function crewSummary(crew: AuditCrewMember[]): string {
  return crew.map(m => `${m.name || m.employeeId || '?'} (${AUDIT_POSITION_LABELS[m.position]})`).join(', ');
}

function rowToAudit(row: Record<string, unknown>): AuditRecord {
  return {
    id:            row.id as string,
    date:          row.created_at as string,
    auditorName:   row.auditor_name as string,
    owningArea:    row.owning_area as string,
    vehicleNumber: row.vehicle_number as string,
    plate:         row.plate as string,
    crew:          row.crew as AuditCrewMember[],
    sections:      row.sections as AuditRecord['sections'],
    status:        row.status as AuditRecord['status'],
    branchId:      row.branch_id as AuditRecord['branchId'],
  };
}

export function AuditDashboard({ onNewAudit }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [liveAudits, setLiveAudits] = useState<AuditRecord[]>([]);

  useEffect(() => {
    if (mode !== 'live' || !user) return;
    async function loadLive() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('audits')
        .select('*')
        .eq('branch_id', user!.branchId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });
      if (data) setLiveAudits((data as Record<string, unknown>[]).map(rowToAudit));
    }
    loadLive();
  }, [mode, user]);

  const audits = mode === 'demo' ? MOCK_AUDITS : liveAudits;
  const passed   = audits.filter(a => a.status === 'PASSED').length;
  const failed   = audits.filter(a => a.status === 'FAILED').length;
  const total    = audits.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Audits</h1>
            {/* Demo / Live toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {(['demo', 'live'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    mode === m
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {total > 0 ? (
            <>
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
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {mode === 'live' ? 'No audits logged today. Export to keep a record.' : 'No audits.'}
            </p>
          )}
        </div>
        <button
          onClick={onNewAudit}
          className="w-10 h-10 bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400 rounded-xl flex items-center justify-center text-black font-bold text-xl transition cursor-pointer shadow-sm shrink-0"
          aria-label="New audit"
        >
          +
        </button>
      </div>

      {/* Live mode notice */}
      {mode === 'live' && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
          <span className="shrink-0">⚠️</span>
          <p>Live audits are cleared at midnight. Use <strong>Export & Send</strong> on each audit form to keep a permanent record.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {[...audits].sort((a, b) => b.date.localeCompare(a.date)).map(audit => (
          <AuditCard key={audit.id} audit={audit} />
        ))}
      </div>
    </div>
  );
}

function AuditCard({ audit }: { audit: AuditRecord }) {
  const fails     = failCount(audit);
  const isPassed  = audit.status === 'PASSED';
  const driverMember = audit.crew.find(m => m.position === 'driver-side');

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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
            Auditor: {audit.auditorName}
            {driverMember ? ` · Driver: ${driverMember.name || driverMember.employeeId}` : ''}
          </p>
          {audit.crew.length > 1 && (
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 truncate" title={crewSummary(audit.crew)}>
              {crewSummary(audit.crew)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
            isPassed
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            {isPassed ? '✅ Passed' : '❌ Failed'}
          </span>
          {!isPassed && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fails} item{fails !== 1 ? 's' : ''} failed</p>
          )}
        </div>
      </div>
    </div>
  );
}
