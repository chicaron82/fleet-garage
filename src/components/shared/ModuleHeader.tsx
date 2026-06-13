import type { ReactNode } from 'react';

interface ModuleHeaderProps {
  title: string;
  /** One-line context under the title. Inline content only (string or spans). */
  subtitle?: ReactNode;
  /** Top-right slot — typically a <PrimaryAction>, but any control (toggle, nav). */
  action?: ReactNode;
  /** Cross-axis alignment of the action against the title block. */
  align?: 'center' | 'start';
}

/**
 * The one header every module wears: bold title, optional gray subtitle, optional
 * top-right action slot. Owning the layout here is what makes "the primary action
 * lives top-right" structurally true instead of a convention each module
 * re-improvises — and drifts from (Schedule had shrunk to text-lg; headers
 * disagreed on items-center vs items-start). Change the look once, here.
 */
export function ModuleHeader({ title, subtitle, action, align = 'center' }: ModuleHeaderProps) {
  return (
    <div className={`flex ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-3`}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">{title}</h1>
        {subtitle != null && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{subtitle}</p>
        )}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}
