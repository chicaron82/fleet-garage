import { MOCK_LOST_FOUND } from '../data/lostAndFound';

function fmtRelative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric',
  });
}

export function LostAndFoundView() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Lost & Found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Items recovered from returned vehicles · {MOCK_LOST_FOUND.length} item{MOCK_LOST_FOUND.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {MOCK_LOST_FOUND.map(item => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Placeholder photo */}
              <div className="shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center transition-colors">
                <span className="text-xl">📦</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm transition-colors">
                  {item.itemDescription}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                  Found in <span className="font-medium text-gray-700 dark:text-gray-300">{item.vehicleUnit}</span>
                  {' '}by {item.foundBy} · {fmtDate(item.foundAt)} ({fmtRelative(item.foundAt)})
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                  Stored: {item.storageLocation}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {MOCK_LOST_FOUND.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No items in lost & found.</p>
        </div>
      )}
    </div>
  );
}
