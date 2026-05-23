import { hapticLight } from '../lib/haptics';
import type { ConditionRating } from '../types';

const CONDITION_RATINGS: ConditionRating[] = ['clean', 'good', 'questionable', 'escalated'];

const CONDITION_CONFIG: Record<ConditionRating, { label: string; activeClass: string }> = {
  clean: {
    label: 'Clean',
    activeClass:
      'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  },
  good: {
    label: 'Good',
    activeClass:
      'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
  },
  questionable: {
    label: 'Questionable',
    activeClass:
      'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  },
  escalated: {
    label: 'Escalated',
    activeClass:
      'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  },
};

interface ConditionRatingsSelectorProps {
  interiorCondition: ConditionRating | null;
  setInteriorCondition: (rating: ConditionRating | null) => void;
  exteriorCondition: ConditionRating | null;
  setExteriorCondition: (rating: ConditionRating | null) => void;
}

export function ConditionRatingsSelector({
  interiorCondition,
  setInteriorCondition,
  exteriorCondition,
  setExteriorCondition,
}: ConditionRatingsSelectorProps) {
  return (
    <div className="space-y-4">
      {(['interior', 'exterior'] as const).map((side) => {
        const value = side === 'interior' ? interiorCondition : exteriorCondition;
        const setter = side === 'interior' ? setInteriorCondition : setExteriorCondition;
        return (
          <div key={side}>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
              {side === 'interior' ? 'Interior' : 'Exterior'} Condition *
            </label>
            <div className="flex gap-2 flex-wrap">
              {CONDITION_RATINGS.map((rating) => {
                const cfg = CONDITION_CONFIG[rating];
                const active = value === rating;
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setter(active ? null : rating);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      active
                        ? cfg.activeClass
                        : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
