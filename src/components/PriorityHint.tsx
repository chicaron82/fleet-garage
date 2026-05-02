import { useState } from 'react';
import { hapticLight } from '../lib/haptics';
import { CLASS_INFO } from '../data/classSubstitutions';
import type { RentalClass } from '../data/manifest';

interface Props {
  flaggedClasses: string[];
  topClasses: string[];
}

export function PriorityHint({ flaggedClasses, topClasses }: Props) {
  const [subGuideOpen, setSubGuideOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<RentalClass | null>(null);

  if (flaggedClasses.length === 0 && topClasses.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {flaggedClasses.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
          <span className="text-xs">🚨</span>
          <p className="text-xs text-red-800 dark:text-red-300">
            <span className="font-bold">Must fulfill:</span>{' '}
            {flaggedClasses.join(', ')}
          </p>
        </div>
      )}

      {topClasses.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
          <button
            type="button"
            onClick={() => { hapticLight(); setSubGuideOpen(o => !o); }}
            className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 cursor-pointer"
          >
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">📋 Priority this window:</span>{' '}
              {topClasses.join(', ')}
            </p>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {subGuideOpen ? '▴' : '▾'}
            </span>
          </button>

          {subGuideOpen && (
            <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900/30">
              {topClasses.map(cls => {
                const info = CLASS_INFO[cls as RentalClass];
                if (!info) return null;
                const isSelected = selectedClass === cls;
                return (
                  <div key={cls}>
                    <button
                      type="button"
                      onClick={() => { hapticLight(); setSelectedClass(isSelected ? null : cls as RentalClass); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 w-6">{cls}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{info.label}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">· {info.example}</span>
                      </div>
                      <span className="text-xs text-gray-400">{isSelected ? '▴' : '▾'}</span>
                    </button>

                    {isSelected && (
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 space-y-1.5 text-xs">
                        {info.acceptable.length > 0 && (
                          <p><span className="font-semibold text-green-600 dark:text-green-400">✅ Acceptable:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.acceptable.join(', ')}</span></p>
                        )}
                        {info.upgradeOk.length > 0 && (
                          <p><span className="font-semibold text-blue-600 dark:text-blue-400">⬆️ Upgrade OK:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.upgradeOk.join(', ')}</span></p>
                        )}
                        {info.stretch.length > 0 && (
                          <p><span className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Stretch:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.stretch.join(', ')} — needs approval</span></p>
                        )}
                        <p><span className="font-semibold text-red-600 dark:text-red-400">🚫 Never:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.never}</span></p>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => { hapticLight(); setSelectedClass(null); }}
                className="w-full px-3 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 text-center cursor-pointer"
              >
                📖 View full class guide
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
