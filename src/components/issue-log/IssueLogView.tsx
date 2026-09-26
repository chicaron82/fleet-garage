import { useState } from 'react';
import { useIssueContext } from '../../context/IssueContext';
import { useUserResolver } from '../../hooks/useUserResolver';
import { hapticLight } from '../../lib/haptics';
import type { FacilityIssue } from '../../types';
import { IssueCard } from './IssueCard';
import { ModuleHeader } from '../shared/ModuleHeader';
import { PrimaryAction } from '../shared/PrimaryAction';
import { NewIssueForm } from './NewIssueForm';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition';

export function IssueLogView() {
  const { facilityIssues, clearIssue, reopenIssue, loadError, reload } = useIssueContext();
  const { getName: getUserName } = useUserResolver();

  const [showCleared, setShowCleared]       = useState(false);
  const [showNewForm, setShowNewForm]       = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');


  if (loadError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load issues. Check your connection.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

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

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <ModuleHeader
        title="Issue Log"
        subtitle={openIssues.length === 0
          ? 'No open issues'
          : `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'}`}
      />

      {/* Search + new issue */}
      <div className="flex gap-2">
        {/* ⚠️⚠️ WAS `type="search"`, which is why this one LOOKED fine to anyone but him: the browser
            draws its own clear on some desktop engines and NONE on Android, so the field he uses had
            nothing while a reviewer's had something. A native affordance that is absent on the only
            device that matters is worse than no affordance — it hides the gap. Explicit now, so it is
            the same button everywhere (2026-09-15). */}
        <div className="relative flex-1">
        <input
          type="text"
          placeholder="Search issues…"
          aria-label="Search issues"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`${inputCls} w-full pr-9`}
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none cursor-pointer"
            aria-label="Clear search">
            ×
          </button>
        )}
        </div>
        <PrimaryAction label="Issue" onClick={() => setShowNewForm(true)} disabled={showNewForm} />
      </div>

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
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center space-y-1.5">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {q ? `No open issues match "${searchQuery.trim()}".` : 'All clear. Nothing logged.'}
            </p>
            {q && clearedIssues.length > 0 && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                ↓ {clearedIssues.length} cleared {clearedIssues.length === 1 ? 'issue matches' : 'issues match'} — reopen below instead of re-adding.
              </p>
            )}
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

      {/* New Issue form — opened from the header action */}
      {showNewForm && <NewIssueForm issues={facilityIssues} onClose={() => setShowNewForm(false)} />}

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
