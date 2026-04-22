import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { USERS } from '../data/mock';
import type { FleetBalanceEntry } from '../hooks/useFleetBalance';

interface Props {
  onSubmit: (outCount: number, inCount: number) => Promise<boolean>;
  todayEntry?: FleetBalanceEntry;
}

export function FleetBalanceEntryForm({ onSubmit, todayEntry }: Props) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(!todayEntry);
  const [outCount, setOutCount] = useState(todayEntry?.outCount.toString() ?? '');
  const [inCount, setInCount] = useState(todayEntry?.inCount.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    const out = parseInt(outCount, 10);
    const in_ = parseInt(inCount, 10);

    if (!out || out <= 0 || !in_ || in_ <= 0) return;

    setSubmitting(true);
    const success = await onSubmit(out, in_);
    setSubmitting(false);

    if (success) {
      setEditing(false);
    }
  };

  const canSubmit = outCount && parseInt(outCount, 10) > 0 && inCount && parseInt(inCount, 10) > 0 && !submitting;

  // Find who entered today's data (if it exists)
  const enteredByUser = todayEntry ? USERS.find(u => u.id === todayEntry.enteredById) : null;

  if (todayEntry && !editing) {
    // Show summary with edit button
    const enteredTime = new Date(todayEntry.enteredAt).toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Today's Fleet Numbers
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition cursor-pointer"
          >
            Edit
          </button>
        </div>
        <div className="flex items-center gap-6 text-gray-900 dark:text-gray-100">
          <div>
            <span className="text-2xl font-bold">{todayEntry.outCount}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">OUT</span>
          </div>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <div>
            <span className="text-2xl font-bold">{todayEntry.inCount}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">IN</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Logged by {enteredByUser?.name ?? 'Unknown'} · {enteredTime}
        </p>
      </div>
    );
  }

  // Show entry form
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-4">
        Today's Fleet Numbers
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">OUT</label>
          <input
            type="number"
            inputMode="numeric"
            value={outCount}
            onChange={e => setOutCount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors"
            placeholder="0"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">IN</label>
          <input
            type="number"
            inputMode="numeric"
            value={inCount}
            onChange={e => setInCount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors"
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Entering as: {user.name} · {user.role}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            canSubmit
              ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white cursor-pointer'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Saving...' : 'Log Numbers'}
        </button>
      </div>
    </div>
  );
}
