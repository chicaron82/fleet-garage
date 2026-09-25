import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { downSince, faultsSummary } from '../../../api/_lib/issueFaults';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { daysOpen } from './issueDate';
import { ShareAction } from '../shared';
import type { FacilityIssue, IssueSeverity } from '../../types';
import { IssueFaultList } from './IssueFaultList';

interface IssueEvent {
  id: string;
  eventType: 'opened' | 'resolved' | 'reopened';
  userId: string;
  note: string | null;
  createdAt: string;
}

const SEVERITY_CONFIG: Record<IssueSeverity, { icon: string; label: string }> = {
  low:    { icon: '🟢', label: 'Low' },
  medium: { icon: '🟡', label: 'Medium' },
  high:   { icon: '🔴', label: 'High' },
};

const EVENT_LABELS: Record<IssueEvent['eventType'], string> = {
  opened:   'Opened',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';

interface IssueCardProps {
  issue: FacilityIssue;
  cleared?: boolean;
  onClear: (issueId: string, note?: string) => Promise<void>;
  onReopen: (issueId: string, note?: string) => Promise<void>;
  getUserName: (id: string) => string;
}

export function IssueCard({ issue, cleared = false, onClear, onReopen, getUserName }: IssueCardProps) {
  const [isClearing, setIsClearing]       = useState(false);
  const [clearNote, setClearNote]         = useState('');
  const [isReopening, setIsReopening]     = useState(false);
  const [reopenNote, setReopenNote]       = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [events, setEvents]               = useState<IssueEvent[] | null>(null);
  // ⭐ FAULTS AS ROWS (migration 150): an open machine is judged by its open faults — each with its own
  // note, photo, days and Clear (IssueFaultList). The line here summarises: one fault reads as before;
  // several read "2 faults · Day 31", counted from the OLDEST. A cleared machine: its first report.
  const faults = !cleared ? (issue.faults ?? []) : [];
  const since = faults.length > 1
    ? `${faults.length} faults · ${daysOpen(downSince(faults)!)}`
    : faults.length === 1
      ? `Reported by ${getUserName(faults[0].openedBy)} · ${daysOpen(faults[0].openedAt)}`
      : `Reported by ${getUserName(issue.reportedById)} · ${daysOpen(issue.reportedAt)}`;

  const cfg = SEVERITY_CONFIG[issue.severity];

  const buildShare = () => {
    const status = issue.clearedAt
      ? `Cleared ${new Date(issue.clearedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : 'Open';
    return {
      title: `Issue: ${issue.title}`,
      text: [
        `${cfg.icon} Issue: ${issue.title}`,
        `${SEVERITY_CONFIG[issue.severity].label} severity`,
        since,
        faults.length ? `"${faultsSummary(faults)}"` : issue.description ? `"${issue.description}"` : null,
        `Status: ${status}`,
        cleared && issue.notes ? `✓ ${issue.notes}` : null,
      ].filter(Boolean).join('\n'),
    };
  };

  const handleConfirmClear = async () => {
    hapticMedium();
    await onClear(issue.id, clearNote.trim() || undefined);
    setIsClearing(false);
    setClearNote('');
    setEvents(null);
  };

  const handleConfirmReopen = async () => {
    hapticMedium();
    await onReopen(issue.id, reopenNote.trim() || undefined);
    setIsReopening(false);
    setReopenNote('');
    setEvents(null);
  };

  const handleToggleHistory = async () => {
    hapticLight();
    if (isHistoryOpen) { setIsHistoryOpen(false); return; }
    setIsHistoryOpen(true);
    if (events !== null) return;
    const { data } = await supabase
      .from('issue_events')
      .select('*')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: false });
    const loaded: IssueEvent[] = (data ?? []).map(r => ({
      id:        r.id as string,
      eventType: r.event_type as IssueEvent['eventType'],
      userId:    r.user_id as string,
      note:      r.note as string | null,
      createdAt: r.created_at as string,
    }));
    // Issues created before migration 027 have no 'opened' event row — synthesize one
    if (!loaded.some(e => e.eventType === 'opened')) {
      loaded.push({
        id:        `synthetic-opened-${issue.id}`,
        eventType: 'opened',
        userId:    issue.reportedById,
        note:      null,
        createdAt: issue.reportedAt,
      });
    }
    setEvents(loaded);
  };

  return (
    <div className={`rounded-xl border p-4 space-y-2 transition-colors ${
      cleared
        ? 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{cfg.icon}</span>
          <p className={`text-base font-semibold truncate ${cleared ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {issue.title}
          </p>
          {issue.reopenCount >= 2 && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
              🔁 {issue.reopenCount}
            </span>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <ShareAction build={buildShare} compact />
          {!cleared && (
            <button
              type="button"
              onClick={() => { hapticLight(); setIsClearing(v => !v); setClearNote(''); setIsReopening(false); }}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition cursor-pointer"
            >
              Clear
            </button>
          )}
          {cleared && (
            <button
              type="button"
              onClick={() => { hapticLight(); setIsReopening(v => !v); setReopenNote(''); setIsClearing(false); }}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {since}
        {cleared && issue.clearedAt && (
          <span> · Cleared {new Date(issue.clearedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        )}
      </p>

      {faults.length > 0 ? (
        <IssueFaultList issue={issue} getUserName={getUserName} />
      ) : (
        <>
          {/* A cleared machine — or one whose faults couldn't load — shows its first report. */}
          {!cleared && issue.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{issue.description}"</p>
          )}
          {issue.photoUrl && (
            <img loading="lazy" src={issue.photoUrl} alt="Issue photo"
              className="w-full max-h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
          )}
        </>
      )}

      {cleared && issue.notes && (
        <p className="text-sm text-green-600 dark:text-green-400">✓ {issue.notes}</p>
      )}

      {isClearing && (
        <div className="mt-2 space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <input
            type="text"
            placeholder="Resolution note (optional)"
            value={clearNote}
            onChange={e => setClearNote(e.target.value)}
            className={inputCls}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmClear}
              className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition cursor-pointer"
            >
              ✓ Confirm Clear
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setIsClearing(false); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isReopening && (
        <div className="mt-2 space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {/* ⭐⭐ REQUIRED, and that is the whole point (his ruling, 2026-09-20). It was optional, so
              both reopens on file carry an EMPTY note — and with the record renamed to the machine,
              a blank reopen leaves the card describing April's fault while the machine is down for a
              new one. The question is the record. */}
          <input
            type="text"
            placeholder="What's wrong this time?"
            value={reopenNote}
            onChange={e => setReopenNote(e.target.value)}
            className={inputCls}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reopenNote.trim()}
              onClick={handleConfirmReopen}
              className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
            >
              ↩ Confirm Reopen
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setIsReopening(false); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggleHistory}
        className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer pt-1"
      >
        <span>{isHistoryOpen ? '▾' : '▸'}</span>
        <span>History</span>
      </button>

      {isHistoryOpen && (
        <div className="pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-800">
          {(events ?? []).length === 0 ? (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic pt-1">No events recorded.</p>
          ) : (
            (events ?? []).map(ev => (
              <div key={ev.id} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] pt-1">
                <span className={`font-semibold ${
                  ev.eventType === 'opened'   ? 'text-blue-500 dark:text-blue-400' :
                  ev.eventType === 'resolved' ? 'text-green-500 dark:text-green-400' :
                                                'text-amber-500 dark:text-amber-400'
                }`}>
                  [{EVENT_LABELS[ev.eventType]}]
                </span>
                <span className="text-gray-500 dark:text-gray-400">{fmtEventTime(ev.createdAt)}</span>
                <span className="text-gray-500 dark:text-gray-400">·</span>
                <span className="text-gray-600 dark:text-gray-300">{getUserName(ev.userId)}</span>
                {ev.note && <span className="text-gray-400 dark:text-gray-500 italic">"{ev.note}"</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
