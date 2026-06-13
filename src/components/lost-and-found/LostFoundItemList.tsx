import { useState } from 'react';
import type { LostFoundLocation } from '../../types';
import { compressImage } from '../../lib/image';

export interface InlineFoundItem {
  id: string;
  description: string;
  location?: LostFoundLocation;
  additionalPhoto?: string;
}

const FOUND_LOCATIONS: { value: LostFoundLocation; label: string }[] = [
  { value: 'trunk',      label: 'Trunk' },
  { value: 'back_seat',  label: 'Back Seat' },
  { value: 'front_seat', label: 'Front' },
  { value: 'visor',      label: 'Visor' },
  { value: 'under_seat', label: 'Under Seat' },
  { value: 'other',      label: 'Other' },
];

interface Props {
  show: boolean;
  items: InlineFoundItem[];
  onOpen: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<InlineFoundItem>) => void;
}

/**
 * Presenter for the in-flow lost-found capture inside CheckInIntakeForm.
 * Owns no state — items live in the parent because they're submitted alongside
 * the check-in row.
 */
export function LostFoundItemList({ show, items, onOpen, onAdd, onRemove, onUpdate }: Props) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  if (!show) {
    return (
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
        >
          + Log Found Item
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Items Found</p>
        {items.map((item, idx) => (
          <div key={item.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 space-y-2.5 border border-gray-200 dark:border-gray-800 transition-colors">
            {items.length > 1 && (
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Item {idx + 1}</p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Description *</label>
              <input
                type="text"
                placeholder="Wooden rod, jacket, luggage…"
                value={item.description}
                onChange={e => onUpdate(item.id, { description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Location</label>
              <div className="flex flex-wrap gap-1.5">
                {FOUND_LOCATIONS.map(loc => (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => onUpdate(item.id, { location: item.location === loc.value ? undefined : loc.value })}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      item.location === loc.value
                        ? 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Photo (optional)</label>
              {item.additionalPhoto ? (
                <div className="flex items-center gap-2">
                  <img src={item.additionalPhoto} alt="Found item" className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, { additionalPhoto: undefined })}
                    className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:border-fg-yellow hover:text-yellow-500 transition cursor-pointer">
                  📷 Add photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const compressed = await compressImage(file);
                      onUpdate(item.id, { additionalPhoto: compressed });
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            {pendingRemoveId === item.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Remove this item?</span>
                <button
                  type="button"
                  onClick={() => setPendingRemoveId(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { onRemove(item.id); setPendingRemoveId(null); }}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPendingRemoveId(item.id)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
        >
          + Add another item
        </button>
      </div>
    </div>
  );
}
