interface Props {
  flaggedClasses: string[];
}

// The "must fulfill" flag shown above the trip form — the operator-flagged priority classes.
// (The old demo-only "priority this window" class-guide expander was removed with the
// demo-side, docs/ticket-remove-demo-side.md.)
export function PriorityHint({ flaggedClasses }: Props) {
  if (flaggedClasses.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
        <span className="text-xs">🚨</span>
        <p className="text-xs text-red-800 dark:text-red-300">
          <span className="font-bold">Must fulfill:</span>{' '}
          {flaggedClasses.join(', ')}
        </p>
      </div>
    </div>
  );
}
