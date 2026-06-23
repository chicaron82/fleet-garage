import { useState, useRef } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { compressImage } from '../../lib/image';
import { LOST_FOUND_LOCATION_LABELS } from '../../types';
import type { LostFoundItem, LostFoundLocation } from '../../types';
import { PlateInput } from '../shared/VehicleFields';
import { SOURCE_PILLS, appendSourceText, removeSourceText } from '../../lib/lostFoundSourcePills';
import type { SourceTag } from '../../lib/lostFoundSourcePills';

const LOCATION_ORDER: LostFoundLocation[] = [
  'visor', 'front_seat', 'back_seat', 'trunk', 'under_seat', 'other',
];

interface Props {
  item: LostFoundItem;
  currentUserName: string;
  onSave: (patch: {
    description: string;
    location: LostFoundLocation | null;
    licensePlate: string;
    notes: string;
    editedByName: string;
    keyTagPhoto?: string;
    itemPhoto?: string;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function LostFoundEditSheet({ item, currentUserName, onSave, onClose }: Props) {
  const [editDesc,     setEditDesc]     = useState(item.description ?? '');
  const [editLocation, setEditLocation] = useState<LostFoundLocation | null>(item.location ?? null);
  const [editPlate,    setEditPlate]    = useState(item.licensePlate ?? '');
  const [editNotes,    setEditNotes]    = useState(item.notes ?? '');
  const [sourceTag,    setSourceTag]    = useState<SourceTag | null>(null);
  const [keyTagPhoto,  setKeyTagPhoto]  = useState<string | null>(null);
  const [itemPhoto,    setItemPhoto]    = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editNotesRef = useRef<HTMLTextAreaElement>(null);
  useEscapeKey(onClose);

  const handleSourcePill = (label: SourceTag, text: string | null) => {
    hapticLight();
    if (text === null) {
      setSourceTag(prev => prev === label ? null : label);
      editNotesRef.current?.focus();
      return;
    }
    if (sourceTag === label) {
      setEditNotes(removeSourceText(editNotes, text));
      setSourceTag(null);
    } else {
      const oldText = SOURCE_PILLS.find(p => p.label === sourceTag)?.text ?? null;
      const base = oldText ? removeSourceText(editNotes, oldText) : editNotes.trim();
      setEditNotes(appendSourceText(base, text));
      setSourceTag(label);
    }
  };

  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter(await compressImage(file));
    e.target.value = '';
  };

  const handleSave = async () => {
    hapticMedium();
    setSaving(true);
    await onSave({
      description:  editDesc.trim(),
      location:     editLocation,
      licensePlate: editPlate.trim().toUpperCase(),
      notes:        editNotes.trim(),
      editedByName: currentUserName,
      ...(keyTagPhoto ? { keyTagPhoto } : {}),
      ...(itemPhoto   ? { itemPhoto }   : {}),
    });
    setSaving(false);
    onClose();
  };

  const photoSlot = (
    label: string,
    currentUrl: string | undefined,
    newPhoto: string | null,
    setter: (v: string) => void,
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {(newPhoto ?? currentUrl) ? (
          <img
            src={newPhoto ?? currentUrl}
            alt={label}
            className="w-14 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0">
            <span className="text-lg">📷</span>
          </div>
        )}
        <div className="flex gap-2">
          <label className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer transition">
            {currentUrl || newPhoto ? 'Replace' : 'Take photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => handlePhotoChange(e, setter)}
            />
          </label>
          <label className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer transition">
            Gallery
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handlePhotoChange(e, setter)}
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl max-h-[85dvh] overflow-y-auto transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit Item</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition">×</button>
        </div>

        <div className="p-4 space-y-5">
          {photoSlot('Key tag photo', item.keyTagPhotoUrl, keyTagPhoto, setKeyTagPhoto)}
          {photoSlot('Item photo',    item.itemPhotoUrl,    itemPhoto,    setItemPhoto)}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              rows={2}
              placeholder="e.g. Black garage door opener, visor…"
              value={editDesc}
              onChange={e => { hapticLight(); setEditDesc(e.target.value); }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Location found</label>
            <div className="flex flex-wrap gap-2">
              {LOCATION_ORDER.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { hapticLight(); setEditLocation(l => l === loc ? null : loc); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    editLocation === loc
                      ? 'bg-fg-yellow border-fg-yellow text-black'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  {LOST_FOUND_LOCATION_LABELS[loc]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License plate</label>
            <PlateInput
              placeholder="e.g. LUR 224"
              value={editPlate}
              onValueChange={v => { hapticLight(); setEditPlate(v); }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Notes</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {SOURCE_PILLS.map(({ label, text }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSourcePill(label, text)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    sourceTag === label
                      ? 'bg-fg-yellow border-fg-yellow text-black'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              ref={editNotesRef}
              rows={2}
              placeholder="Any additional context…"
              value={editNotes}
              onChange={e => { hapticLight(); setEditNotes(e.target.value); }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
