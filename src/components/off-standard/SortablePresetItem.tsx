import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { hapticLight } from '../../lib/haptics';
import type { QuickTap } from '../../hooks/useOffStandardSession';

/** One draggable preset row in the customizer (mirrors the sidebar's SortableNavItem). */
export function SortablePresetItem({ tap, pinned }: { tap: QuickTap; pinned: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tap.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
        pinned
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-fg-yellow'
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
      }`}
    >
      <span className="text-base shrink-0">{tap.emoji}</span>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{tap.label}</span>
      {pinned && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-400 shrink-0">
          Top 4
        </span>
      )}
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
