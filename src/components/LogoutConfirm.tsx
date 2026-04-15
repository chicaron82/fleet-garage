interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function LogoutConfirm({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 space-y-4 transition-colors">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Sign out?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You'll need to enter your employee ID to get back in.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
