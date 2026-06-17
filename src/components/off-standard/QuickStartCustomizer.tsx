import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '../layout/dndModifiers';
import { SortablePresetItem } from './SortablePresetItem';
import { QUICK_START_VISIBLE } from '../../lib/quickStartOrder';
import type { QuickTap } from '../../hooks/useOffStandardSession';

interface Props {
  draftTaps: QuickTap[];
  draftOrder: string[];
  isCustomized: boolean;
  onDragEnd: (activeId: string, overId: string) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}

/** Drag-to-reorder sheet for the quick-start presets — the sidebar Edit-Menu
 *  pattern applied to the preset grid. The top {QUICK_START_VISIBLE} are the
 *  pinned set; everything below collapses behind the chevron. */
export function QuickStartCustomizer({
  draftTaps, draftOrder, isCustomized, onDragEnd, onSave, onReset, onClose,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customize Quick Start</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Drag to reorder. The top {QUICK_START_VISIBLE} show by default; the rest tuck behind the chevron.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e: DragEndEvent) => { const { active, over } = e; if (over) onDragEnd(active.id as string, over.id as string); }}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={draftOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {draftTaps.map((tap, i) => (
                  <div key={tap.id}>
                    {i === QUICK_START_VISIBLE && (
                      <div className="flex items-center gap-2 py-1.5">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Collapsed below</span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>
                    )}
                    <SortablePresetItem tap={tap} pinned={i < QUICK_START_VISIBLE} />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          {isCustomized && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition cursor-pointer"
            >
              Reset to default
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            className="flex-1 py-2.5 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 text-sm font-semibold transition cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
