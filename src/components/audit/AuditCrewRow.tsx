import { useState } from 'react';
import { useProfiles, useRosterStaff } from '../../context/ProfilesContext';
import { useAuth } from '../../context/AuthContext';
import { useUserResolver } from '../../hooks/useUserResolver';
import { searchCrewCandidates } from '../../lib/crewSearch';
import { hapticLight } from '../../lib/haptics';
import { canManageSchedule, AUDIT_POSITION_LABELS } from '../../types';
import type { AuditCrewMember, AuditPosition, Profile } from '../../types';

const INPUT = 'px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition';

/**
 * Crew-assignment row, name-first: search the roster by name and the employee id
 * fills in. A name with no match can be added inline (Lead VSA and up only) — it
 * becomes a roster profile, shared with the schedule and there for next audit.
 */
export function CrewRow({ member, showRemove, onChange, onRemove }: {
  member: AuditCrewMember;
  showRemove: boolean;
  onChange: (patch: Partial<AuditCrewMember>) => void;
  onRemove: () => void;
}) {
  const profiles = useProfiles();
  const { getByEmployeeId } = useUserResolver();
  const { addRosterStaff } = useRosterStaff();
  const { user, activeBranch } = useAuth();

  const [query, setQuery]   = useState('');
  const [focused, setFocused] = useState(false);
  const [adding, setAdding] = useState(false);

  const canAdd   = user ? canManageSchedule(user.role) : false;
  const resolved = member.employeeId ? getByEmployeeId(member.employeeId) : null;
  const filled   = !!member.name || !!member.employeeId;

  const candidates = searchCrewCandidates(Array.from(profiles.values()), query);
  const exactish   = candidates.some(c => c.name.toLowerCase() === query.trim().toLowerCase());
  const showAdd    = canAdd && query.trim().length >= 2 && !exactish && !adding;
  const showDrop   = focused && query.trim().length >= 1 && (candidates.length > 0 || showAdd);

  const pick = (p: Profile) => { onChange({ employeeId: p.employeeId, name: p.name }); setQuery(''); setFocused(false); };
  const clear = () => { onChange({ employeeId: '', name: '' }); setQuery(''); };
  const handleAdd = async () => {
    const name = query.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
      const p = await addRosterStaff({ name, role: 'VSA', branchId });
      pick(p);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0 relative">
          {filled ? (
            <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border ${resolved ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'}`}>
              <span className={`text-sm truncate ${resolved ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {resolved ? `✓ ${resolved.name} · ${resolved.role}` : member.name || member.employeeId}
              </span>
              <button type="button" onClick={clear} aria-label="Change crew member" className="shrink-0 text-gray-400 hover:text-red-500 text-base leading-none cursor-pointer">×</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder="Search crew by name…"
                className={`w-full ${INPUT}`}
              />
              {showDrop && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
                  {candidates.map(c => (
                    <button key={c.id} type="button" onClick={() => { hapticLight(); pick(c); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm flex items-center justify-between gap-2 cursor-pointer">
                      <span className="truncate text-gray-800 dark:text-gray-200">{c.name}{c.rosterOnly ? ' (roster)' : ''}</span>
                      <span className="text-xs text-gray-400 shrink-0">{c.employeeId}</span>
                    </button>
                  ))}
                  {showAdd && (
                    <button type="button" onClick={() => { hapticLight(); void handleAdd(); }}
                      className="w-full text-left px-3 py-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-sm font-semibold text-yellow-700 dark:text-yellow-400 border-t border-gray-100 dark:border-gray-800 cursor-pointer">
                      + Add “{query.trim()}” as new crew
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <select
          value={member.position}
          onChange={e => onChange({ position: e.target.value as AuditPosition })}
          className={`shrink-0 w-36 cursor-pointer ${INPUT}`}
        >
          {(Object.keys(AUDIT_POSITION_LABELS) as AuditPosition[]).map(pos => (
            <option key={pos} value={pos}>{AUDIT_POSITION_LABELS[pos]}</option>
          ))}
        </select>

        {showRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove crew member"
            className="shrink-0 w-9 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer">
            ×
          </button>
        )}
      </div>

      {!filled && query.trim().length >= 2 && candidates.length === 0 && !canAdd && (
        <p className="text-xs text-gray-400 dark:text-gray-500 pl-0.5">No match — a Lead VSA can add a new name.</p>
      )}
    </div>
  );
}
