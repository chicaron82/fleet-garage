import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { LOST_FOUND_LOCATION_LABELS } from '../../types';
import type { LostFoundItem, LostFoundLocation } from '../../types';
import { fmtRelativeDate, daysHeld, ageTier } from '../../lib/lostFoundDate';
import { ShareAction } from '../shared';
import { LostFoundEditSheet } from './LostFoundEditSheet';

interface CardProps {
  item: LostFoundItem;
  currentUserName: string;
  updating: boolean;
  canAction: boolean;
  onContactCustomer: () => void;
  onMarkReturned: () => void;
  onDispose: () => void;
  onPhotoTap: (url: string) => void;
  onEditSave: (patch: {
    description: string;
    location: LostFoundLocation | null;
    licensePlate: string;
    notes: string;
    editedByName: string;
    keyTagPhoto?: string;
    itemPhoto?: string;
  }) => Promise<boolean>;
}

export function LostFoundCard({
  item,
  currentUserName,
  updating,
  canAction,
  onContactCustomer,
  onMarkReturned,
  onDispose,
  onPhotoTap,
  onEditSave,
}: CardProps) {
  const vehicleLabel = item.unitNumber
    ? `Unit ${item.unitNumber}${item.licensePlate ? ` · ${item.licensePlate}` : ''}`
    : item.licensePlate ?? null;

  const held = daysHeld(item.foundAt);
  const tier = ageTier(item.status, held);
  const tierClass = tier === 'fresh' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    : tier === 'aging' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
    : tier === 'expired' ? 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30'
    : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';

  const [editOpen, setEditOpen] = useState(false);
  const [pendingDispose, setPendingDispose] = useState(false);

  const handleOpenEdit = () => { hapticLight(); setEditOpen(true); };

  const buildShare = () => ({
    title: 'Lost & Found Item',
    text: [
      `Lost & Found — ${item.description ?? 'No description'}`,
      item.location ? `📍 ${LOST_FOUND_LOCATION_LABELS[item.location]}` : null,
      vehicleLabel,
      item.vehicleMake ?? null,
      `Found by: ${item.foundByName} · ${fmtRelativeDate(item.foundAt)}`,
      item.notes ? `"${item.notes}"` : null,
    ].filter(Boolean).join('\n'),
  });

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
          {item.keyTagPhotoUrl && (
            <img
              src={item.keyTagPhotoUrl}
              alt="Key tag"
              onClick={() => {
                hapticLight();
                onPhotoTap(item.keyTagPhotoUrl!);
              }}
              className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer active:opacity-80 transition"
            />
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
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {item.location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-[11px] font-semibold border border-yellow-200 dark:border-yellow-800/40">
                  📍 {LOST_FOUND_LOCATION_LABELS[item.location]}
                </span>
              )}
              {vehicleLabel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                  {vehicleLabel}
                </span>
              )}
            </div>
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
            {tier && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                Day {held}
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
          <div className="space-y-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
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

            {/* Disposal — gated like the rest, but a plain VSA only reaches it via the
                30-day age unlock. Irreversible, so it's a two-step confirm. */}
            {pendingDispose ? (
              <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">Throw out? Can't be undone.</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPendingDispose(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer">Cancel</button>
                  <button type="button" disabled={updating} onClick={onDispose} className="text-xs font-bold text-red-600 hover:text-red-800 dark:hover:text-red-300 transition cursor-pointer disabled:opacity-50">{updating ? 'Updating…' : 'Throw out'}</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { hapticLight(); setPendingDispose(true); }}
                className="w-full py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
              >
                🗑️ Thrown out{tier === 'expired' ? ' · 30+ days' : ''}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <ShareAction build={buildShare} />
        </div>
      </div>

      {editOpen && (
        <LostFoundEditSheet
          item={item}
          currentUserName={currentUserName}
          onSave={onEditSave}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
