import { useState } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { LOST_FOUND_LOCATION_LABELS } from '../types';
import type { LostFoundItem, LostFoundLocation } from '../types';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return `Today ${fmtTime(iso)}`;
  if (days === 1) return `Yesterday ${fmtTime(iso)}`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const LOCATION_ORDER: LostFoundLocation[] = [
  'visor',
  'front_seat',
  'back_seat',
  'trunk',
  'under_seat',
  'other',
];

interface CardProps {
  item: LostFoundItem;
  currentUserName: string;
  updating: boolean;
  canAction: boolean;
  onContactCustomer: () => void;
  onMarkReturned: () => void;
  onPhotoTap: (url: string) => void;
  onEditSave: (patch: {
    description: string;
    location: LostFoundLocation | null;
    licensePlate: string;
    notes: string;
    editedByName: string;
  }) => Promise<boolean>;
}

export function LostFoundCard({
  item,
  currentUserName,
  updating,
  canAction,
  onContactCustomer,
  onMarkReturned,
  onPhotoTap,
  onEditSave,
}: CardProps) {
  const vehicleLabel = item.unitNumber
    ? `Unit ${item.unitNumber}${item.licensePlate ? ` · ${item.licensePlate}` : ''}`
    : item.licensePlate ?? null;

  const [today] = useState(() => Date.now());
  const daysHeld = Math.floor((today - new Date(item.foundAt).getTime()) / 86_400_000);
  const ageTier = item.status === 'returned' ? null : daysHeld >= 30 ? 'expired' : daysHeld >= 15 ? 'aging' : 'fresh';
  const tierClass = ageTier === 'fresh' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    : ageTier === 'aging' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
    : ageTier === 'expired' ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30'
    : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';

  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editLocation, setEditLocation] = useState<LostFoundLocation | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenEdit = () => {
    setEditDesc(item.description ?? '');
    setEditLocation(item.location ?? null);
    setEditPlate(item.licensePlate ?? '');
    setEditNotes(item.notes ?? '');
    setEditOpen(true);
    hapticLight();
  };

  const handleSave = async () => {
    hapticMedium();
    setSaving(true);
    await onEditSave({
      description: editDesc.trim(),
      location: editLocation,
      licensePlate: editPlate.trim().toUpperCase(),
      notes: editNotes.trim(),
      editedByName: currentUserName,
    });
    setSaving(false);
    setEditOpen(false);
  };

  return (
    <>
      <div
        onClick={handleOpenEdit}
        className={`rounded-xl border ${tierClass} p-4 space-y-3 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 relative`}
      >
        <span className="absolute top-3 right-3 text-gray-300 dark:text-gray-600 text-xs select-none">
          ✏️
        </span>
        {/* Photos row */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {item.keyTagPhotoUrl ? (
            <img
              src={item.keyTagPhotoUrl}
              alt="Key tag"
              onClick={() => {
                hapticLight();
                onPhotoTap(item.keyTagPhotoUrl!);
              }}
              className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer active:opacity-80 transition"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 transition-colors">
              <span className="text-lg">🏷️</span>
            </div>
          )}
          {item.itemPhotoUrl ? (
            <img
              src={item.itemPhotoUrl}
              alt="Item"
              onClick={() => {
                hapticLight();
                onPhotoTap(item.itemPhotoUrl!);
              }}
              className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer active:opacity-80 transition"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 transition-colors">
              <span className="text-lg">📦</span>
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-medium text-gray-900 dark:text-gray-100 text-base transition-colors">
              {item.description ?? (
                <span className="text-gray-400 dark:text-gray-500 italic">No description</span>
              )}
            </p>
            {(item.location || vehicleLabel) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                {item.location && LOST_FOUND_LOCATION_LABELS[item.location]}
                {item.location && vehicleLabel && ' · '}
                {vehicleLabel}
              </p>
            )}
            {item.vehicleMake && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                {item.vehicleMake}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
              Found by{' '}
              <span className="font-medium text-gray-600 dark:text-gray-400">
                {item.foundByName}
              </span>{' '}
              · {fmtRelativeDate(item.foundAt)}
            </p>
            {ageTier && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                Day {daysHeld}
              </p>
            )}
            {item.editedByName && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                Edited by{' '}
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  {item.editedByName}
                </span>
                {item.editedAt ? ` · ${fmtRelativeDate(item.editedAt)}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Status indicator for customer_contacted */}
        {item.status === 'customer_contacted' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg px-3 py-2 transition-colors">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              📞 Customer contacted
            </p>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic transition-colors">
            "{item.notes}"
          </p>
        )}

        {/* Actions */}
        {canAction && (
          <div className="flex gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {item.status === 'holding' && (
              <button
                type="button"
                disabled={updating}
                onClick={onContactCustomer}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition cursor-pointer"
              >
                Customer contacted
              </button>
            )}
            <button
              type="button"
              disabled={updating}
              onClick={onMarkReturned}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition cursor-pointer"
            >
              {updating ? 'Updating…' : 'Mark returned'}
            </button>
          </div>
        )}
      </div>

      {/* Edit sheet */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setEditOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl max-h-[85dvh] overflow-y-auto transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors">
                Edit Item
              </p>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Black garage door opener, visor…"
                  value={editDesc}
                  onChange={(e) => {
                    hapticLight();
                    setEditDesc(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Location found
                </label>
                <div className="flex flex-wrap gap-2">
                  {LOCATION_ORDER.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setEditLocation((l) => (l === loc ? null : loc));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        editLocation === loc
                          ? 'bg-yellow-400 border-yellow-400 text-black'
                          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      {LOST_FOUND_LOCATION_LABELS[loc]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  License plate
                </label>
                <input
                  type="text"
                  placeholder="e.g. LUR 224"
                  value={editPlate}
                  onChange={(e) => {
                    hapticLight();
                    setEditPlate(e.target.value.toUpperCase());
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Any additional context…"
                  value={editNotes}
                  onChange={(e) => {
                    hapticLight();
                    setEditNotes(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
