interface Props {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Prev/Next pager for the holds list. Renders nothing for a single page. */
export function HoldsPagination({ currentPage, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between py-2 transition-colors">
      <button
        disabled={currentPage === 1}
        onClick={() => onChange(currentPage - 1)}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Page <span className="font-medium text-gray-900 dark:text-gray-100">{currentPage}</span> of {totalPages}
      </span>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onChange(currentPage + 1)}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}
