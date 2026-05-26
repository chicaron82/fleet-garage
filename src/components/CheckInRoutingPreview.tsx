/* eslint-disable react-refresh/only-export-components */
import type { CheckInRouting } from '../types';

export const ROUTING_CONFIG: Record<
  CheckInRouting,
  {
    icon: string;
    label: string;
    description: string;
    className: string;
    textClass: string;
  }
> = {
  flip: {
    icon: '✅',
    label: 'Flip Eligible',
    description:
      'Interior and exterior both clean. Vehicle can be flipped at the booth.',
    className:
      'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40',
    textClass: 'text-green-700 dark:text-green-400',
  },
  washbay: {
    icon: '🚿',
    label: 'Send to Washbay',
    description: 'Vehicle needs standard cleaning before returning to fleet.',
    className:
      'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  review: {
    icon: '🔍',
    label: 'Needs Review',
    description: 'Condition is questionable. Hold at HIR for second opinion.',
    className:
      'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  escalated: {
    icon: '🚨',
    label: 'Escalated',
    description: 'Definite issue found. Flag for management review.',
    className:
      'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
    textClass: 'text-red-700 dark:text-red-400',
  },
};

interface CheckInRoutingPreviewProps {
  routing: CheckInRouting;
}

export function CheckInRoutingPreview({ routing }: CheckInRoutingPreviewProps) {
  const cfg = ROUTING_CONFIG[routing];
  if (!cfg) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${cfg.className}`}>
      <p className={`text-sm font-semibold ${cfg.textClass}`}>
        {cfg.icon} {cfg.label}
      </p>
      <p className={`text-xs mt-0.5 ${cfg.textClass} opacity-80`}>
        {cfg.description}
      </p>
    </div>
  );
}
