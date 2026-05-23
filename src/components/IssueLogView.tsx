import { useState } from 'react';
import { useGarage } from '../context/GarageContext';
import { useUserResolver } from '../hooks/useUserResolver';
import { hapticLight, hapticMedium } from '../lib/haptics';
import type { FacilityIssue, IssueSeverity } from '../types';
import { IssueCard } from './IssueCard';

const SEVERITY_CONFIG: Record<IssueSeverity, { icon: string; label: string }> = {
  low:    { icon: '🟢', label: 'Low' },
  medium: { icon: '🟡', label: 'Medium' },
  high:   { icon: '🔴', label: 'High' },
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition';

export function IssueLogView() {
  const { facilityIssues, addIssue, clearIssue, reopenIssue } = useGarage();
  const { getName: getUserName } = useUserResolver();

  const [showCleared, setShowCleared]       = useState(false);
  const [showNewForm, setShowNewForm]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');

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

        {openIssues.map(issue => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onClear={clearIssue}
            onReopen={reopenIssue}
            getUserName={getUserName}
          />
        ))}
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

          {shouldShowCleared && clearedIssues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              cleared
              onClear={clearIssue}
              onReopen={reopenIssue}
              getUserName={getUserName}
            />
          ))}
        </section>
      )}

    </div>
  );
}
