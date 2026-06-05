import type { LotStatus } from '../../types';

// Lot state recorded at close, shared by the closing-log input form and its
// post-submit summary. Kept in its own module so both component files can import
// it without tripping the react-refresh "only export components" rule.
export const LOT_STATUS_OPTIONS: { value: LotStatus; label: string; color: string }[] = [
  { value: 'zeroed',     label: 'Zeroed',     color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'manageable', label: 'Manageable', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'backlog',    label: 'Backlog',    color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
];
