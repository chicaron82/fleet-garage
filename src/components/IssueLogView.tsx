import { useState } from 'react';
import { useGarage } from '../context/GarageContext';
import { USERS } from '../data/mock';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import type { FacilityIssue, IssueSeverity } from '../types';

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

function daysOpen(reportedAt: string): string {
  const days = Math.floor((Date.now() - new Date(reportedAt).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Day 1';
  return `Day ${days}`;
}

function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function IssueLogView() {
  const { facilityIssues, addIssue, clearIssue, reopenIssue } = useGarage();

  const [clearingId, setClearingId]         = useState<string | null>(null);
  const [clearNote, setClearNote]           = useState('');
  const [reopenId, setReopenId]             = useState<string | null>(null);
  const [reopenNote, setReopenNote]         = useState('');
  const [showCleared, setShowCleared]       = useState(false);
  const [showNewForm, setShowNewForm]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [eventsCache, setEventsCache]       = useState<Record<string, IssueEvent[]>>({});

  // New issue form state
  const [newTitle, setNewTitle]             = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity]       = useState<IssueSeverity>('medium');
  const [submitting, setSubmitting]         = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (issue: FacilityIssue) =>
    !q ||
    issue.title.toLowerCase().includes(q) ||
    (issue.description ?? '').toLowerCase().includes(q) ||
    (issue.notes ?? '').toLowerCase().includes(q);

  const openIssues     = facilityIssues.filter(i => i.status !== 'resolved' && matchesSearch(i));
  const clearedIssues  = facilityIssues.filter(i => i.status === 'resolved'  && matchesSearch(i));
  const openHighIssues = facilityIssues.filter(i => i.status !== 'resolved'  && i.severity === 'high').length;
  const shouldShowCleared = showCleared || (!!q && clearedIssues.length > 0);

  const getUserName = (userId: string) =>
    USERS.find((u: { id: string; name: string }) => u.id === userId)?.name ?? userId;

  const invalidateCache = (issueId: string) =>
    setEventsCache(prev => { const next = { ...prev }; delete next[issueId]; return next; });

  const handleClear = async (issueId: string) => {
    hapticMedium();
    await clearIssue(issueId, clearNote.trim() || undefined);
    setClearingId(null);
    setClearNote('');
    invalidateCache(issueId);
  };

  const handleReopen = async (issueId: string) => {
    hapticMedium();
    await reopenIssue(issueId, reopenNote.trim() || undefined);
    setReopenId(null);
    setReopenNote('');
    invalidateCache(issueId);
  };

  const handleToggleHistory = async (issue: FacilityIssue) => {
    hapticLight();
    if (expandedHistoryId === issue.id) { setExpandedHistoryId(null); return; }
    setExpandedHistoryId(issue.id);
    if (eventsCache[issue.id]) return;
    const { data } = await supabase
      .from('issue_events')
      .select('*')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: false });
    const events: IssueEvent[] = (data ?? []).map(r => ({
      id:        r.id as string,
      eventType: r.event_type as IssueEvent['eventType'],
      userId:    r.user_id as string,
      note:      r.note as string | null,
      createdAt: r.created_at as string,
    }));
    // Issues created before migration 027 have no 'opened' event row — synthesize one
    if (!events.some(e => e.eventType === 'opened')) {
      events.push({
        id:        `synthetic-opened-${issue.id}`,
        eventType: 'opened',
        userId:    issue.reportedById,
        note:      null,
        createdAt: issue.reportedAt,
      });
    }
    setEventsCache(prev => ({ ...prev, [issue.id]: events }));
  };

  const handleSubmitNew = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    hapticMedium();
    await addIssue({ title: newTitle.trim(), description: newDescription.trim() || undefined, severity: newSeverity });
    setNewTitle('');
    setNewDescription('');
    setNewSeverity('medium');
    setShowNewForm(false);
    setSubmitting(false);
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';

  const renderIssueCard = (issue: FacilityIssue, cleared = false) => {
    const cfg             = SEVERITY_CONFIG[issue.severity];
    const isClearingThis  = clearingId === issue.id;
    const isReopeningThis = reopenId === issue.id;
    const isHistoryOpen   = expandedHistoryId === issue.id;

    return (
      <div
        key={issue.id}
        className={`rounded-xl border p-4 space-y-2 transition-colors ${
          cleared
            ? 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">{cfg.icon}</span>
            <p className={`text-sm font-semibold truncate ${cleared ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              {issue.title}
            </p>
            {issue.reopenCount >= 2 && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                🔁 {issue.reopenCount}
              </span>
            )}
          </div>
          <div className="shrink-0">
            {!cleared && (
              <button
                type="button"
                onClick={() => { hapticLight(); setClearingId(isClearingThis ? null : issue.id); setClearNote(''); setReopenId(null); }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition cursor-pointer"
              >
                Clear
              </button>
            )}
            {cleared && (
              <button
                type="button"
                onClick={() => { hapticLight(); setReopenId(isReopeningThis ? null : issue.id); setReopenNote(''); setClearingId(null); }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Reported by {getUserName(issue.reportedById)} · {daysOpen(issue.reportedAt)}
          {cleared && issue.clearedAt && (
            <span> · Cleared {new Date(issue.clearedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          )}
        </p>

        {issue.description && (
          <p className="text-xs text-gray-600 dark:text-gray-300 italic">"{issue.description}"</p>
        )}

        {cleared && issue.notes && (
          <p className="text-xs text-green-600 dark:text-green-400">✓ {issue.notes}</p>
        )}

        {/* Clear prompt */}
        {isClearingThis && (
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
                onClick={() => handleClear(issue.id)}
                className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition cursor-pointer"
              >
                ✓ Confirm Clear
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); setClearingId(null); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reopen prompt */}
        {isReopeningThis && (
          <div className="mt-2 space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input
              type="text"
              placeholder="Reopen note (optional)"
              value={reopenNote}
              onChange={e => setReopenNote(e.target.value)}
              className={inputCls}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReopen(issue.id)}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer"
              >
                ↩ Confirm Reopen
              </button>
              <button
                type="button"
                onClick={() => { hapticLight(); setReopenId(null); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* History toggle + panel */}
        <button
          type="button"
          onClick={() => handleToggleHistory(issue)}
          className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer pt-1"
        >
          <span>{isHistoryOpen ? '▾' : '▸'}</span>
          <span>History</span>
        </button>

        {isHistoryOpen && (
          <div className="pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-800">
            {(eventsCache[issue.id] ?? []).length === 0 ? (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 italic pt-1">No events recorded.</p>
            ) : (
              (eventsCache[issue.id] ?? []).map(ev => (
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
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Issue Log</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {openIssues.length === 0
              ? 'No open issues'
              : `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search issues…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className={inputCls}
      />

      {/* High-severity banner */}
      {openHighIssues > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg shrink-0">🔴</span>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {openHighIssues} high-severity issue{openHighIssues !== 1 ? 's' : ''} open
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              {openHighIssues !== 1 ? 'These require' : 'This requires'} attention — see below
            </p>
          </div>
        </div>
      )}

      {/* Open Issues */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Open Issues · {openIssues.length}
        </p>

        {openIssues.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {q ? 'No matching open issues.' : 'All clear. Nothing logged.'}
            </p>
          </div>
        )}

        {openIssues.map(issue => renderIssueCard(issue, false))}
      </section>

      {/* Log New Issue */}
      {!showNewForm ? (
        <button
          type="button"
          onClick={() => { hapticLight(); setShowNewForm(true); }}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition cursor-pointer"
        >
          + Log New Issue
        </button>
      ) : (
        <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10 p-4 space-y-3">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">New Issue</p>

          <input
            type="text"
            placeholder="Title (required)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className={inputCls}
            autoFocus
          />

          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />

          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as IssueSeverity[]).map(s => {
              const cfg    = SEVERITY_CONFIG[s];
              const active = newSeverity === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { hapticLight(); setNewSeverity(s); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    active
                      ? 'bg-yellow-400 dark:bg-yellow-500 border-yellow-400 dark:border-yellow-500 text-black'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitNew}
              disabled={!newTitle.trim() || submitting}
              className="flex-1 py-2 rounded-lg bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-500 text-black text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Logging…' : '+ Log Issue'}
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setShowNewForm(false); setNewTitle(''); setNewDescription(''); setNewSeverity('medium'); }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cleared Issues */}
      {clearedIssues.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => { hapticLight(); setShowCleared(s => !s); }}
            className="flex items-center gap-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
          >
            <span>{shouldShowCleared ? '▾' : '▸'}</span>
            <span>Cleared · {clearedIssues.length}</span>
          </button>

          {shouldShowCleared && clearedIssues.map(issue => renderIssueCard(issue, true))}
        </section>
      )}

    </div>
  );
}
