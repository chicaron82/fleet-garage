import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useAuth } from '../../context/AuthContext';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { useRosterStaff } from '../../context/ProfilesContext';
import type { BranchId, UserRole } from '../../types';

// Roles you'd transcribe off the breakroom board — floor + drivers + counter.
const ROSTER_ROLES: UserRole[] = ['VSA', 'Lead VSA', 'Driver', 'CSR', 'HIR'];

export function RosterStaffModal({ onClose }: { onClose: () => void }) {
  const { user, activeBranch } = useAuth();
  const teamMembers = useTeamMembers();
  const { addRosterStaff, removeRosterStaff } = useRosterStaff();

  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('VSA');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  useEscapeKey(onClose);

  // Roster staff belong to a real branch, never "ALL" — default to where you're working.
  const branchId: BranchId = activeBranch !== 'ALL' ? activeBranch : (user?.branchId ?? 'YWG');
  const rosterStaff = teamMembers
    .filter(m => m.rosterOnly)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await addRosterStaff({ name: name.trim(), role, branchId });
      setName('');
      setRole('VSA');
    } catch {
      setError('Failed to add. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Roster Staff</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Board-only crew — schedule them in FG without a login.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Add */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Name (e.g. Marisol)"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="shrink-0 px-2 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
            >
              {ROSTER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving || !name.trim()}
            className="w-full py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 text-white dark:text-gray-900 font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            {saving ? 'Adding…' : `Add to ${branchId}`}
          </button>
        </div>

        {/* Existing */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {rosterStaff.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              No roster staff yet. Add the floor + driver schedule from the board.
            </p>
          ) : (
            rosterStaff.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.name}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">{m.role} · {m.branchId}</div>
                </div>
                {pendingRemove === m.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setPendingRemove(null)} className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium cursor-pointer">Cancel</button>
                    <button
                      onClick={async () => { await removeRosterStaff(m.id); setPendingRemove(null); }}
                      className="text-[11px] text-red-600 dark:text-red-400 font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPendingRemove(m.id)}
                    aria-label={`Remove ${m.name}`}
                    className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer text-sm"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Removing a staffer stops scheduling them going forward. Their shift rows stay in the
          data but will read as unknown, so only remove people you added by mistake.
        </p>
      </div>
    </div>
  );
}
