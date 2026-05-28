import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { hapticLight } from '../../lib/haptics';
import type { NavItem } from '../../lib/navigation';

interface SortableNavItemProps {
  item: NavItem;
  isHidden: boolean;
  onToggleHidden: () => void;
  badge?: number;
}

export function SortableNavItem({
  item, isHidden, onToggleHidden, badge,
}: SortableNavItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.module });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isHidden ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
    >
      <button
        type="button"
        onClick={onToggleHidden}
        disabled={item.module === 'holds'}
        className="text-base leading-none shrink-0 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title={isHidden ? 'Show' : 'Hide'}
      >
        {isHidden ? '🚫' : '👁️'}
      </button>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {item.icon} {item.label}
      </span>
      {badge ? (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shrink-0">
          {badge}
        </span>
      ) : null}
      <button
        type="button"
        className="text-gray-400 cursor-grab active:cursor-grabbing px-1 touch-none"
        onPointerDown={() => hapticLight()}
        {...attributes}
        {...listeners}
      >
        ≡
      </button>
    </div>
  );
}
