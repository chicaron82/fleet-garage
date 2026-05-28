import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { hapticLight } from '../../lib/haptics';
import type { LostFoundStatus } from '../../types';
import { canActionLostFound } from '../../types';
import { LostFoundCard } from './LostFoundCard';
import { LogLostFoundItemModal } from './LogLostFoundItemModal';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return `Today ${fmtTime(iso)}`;
  if (days === 1) return `Yesterday ${fmtTime(iso)}`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function LostAndFoundView() {
  const { user } = useAuth();
  const { lostFoundItems, addLostFoundItem, updateLostFoundStatus, updateLostFoundItem } = useLostFoundContext();

  const [query, setQuery]                   = useState('');
  const [lightboxUrl, setLightboxUrl]       = useState<string | null>(null);
  const [showSheet, setShowSheet]           = useState(false);
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const [updatingId, setUpdatingId]         = useState<string | null>(null);

  const canAction = user ? canActionLostFound(user.role) : false;
  const holding = lostFoundItems.filter(i => i.status !== 'returned');
  const resolved = lostFoundItems.filter(i => i.status === 'returned');

  const q = query.trim().toLowerCase();
  const filteredHolding = q
    ? holding.filter(i =>
        [i.description, i.licensePlate, i.unitNumber, i.notes, i.vehicleMake]
          .some(f => f?.toLowerCase().includes(q))
      )
    : holding;

  const handleStatusUpdate = async (id: string, status: LostFoundStatus) => {
    hapticLight();
    setUpdatingId(id);
    await updateLostFoundStatus(id, status);
    setUpdatingId(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Lost & Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
            {holding.length} item{holding.length !== 1 ? 's' : ''} holding
          </p>
        </div>
        <button
          type="button"
          onClick={() => { hapticLight(); setShowSheet(true); }}
          className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          + Log
        </button>
      </div>

      {/* Search */}
      {holding.length > 0 && (
        <input
          type="search"
          placeholder="Search by description, plate, notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
        />
      )}

      {/* Holding items */}
      {holding.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Holding{q ? ` · ${filteredHolding.length} of ${holding.length}` : ''}
          </p>
          <div className="space-y-3">
            {filteredHolding.length > 0 ? filteredHolding.map(item => (
              <LostFoundCard
                key={item.id}
                item={item}
                currentUserName={user?.name ?? ''}
                updating={updatingId === item.id}
                canAction={canAction}
                onContactCustomer={() => handleStatusUpdate(item.id, 'customer_contacted')}
                onMarkReturned={() => handleStatusUpdate(item.id, 'returned')}
                onPhotoTap={setLightboxUrl}
                onEditSave={patch => updateLostFoundItem(item.id, patch)}
              />
            )) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No items match "{query}"</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No items in lost & found.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tap + Log to document a found item.</p>
        </div>
      )}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { hapticLight(); setResolvedExpanded(e => !e); }}
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest cursor-pointer hover:text-gray-600 dark:hover:text-gray-400 transition"
          >
            <span>{resolvedExpanded ? '▾' : '▸'}</span>
            <span>Resolved ({resolved.length})</span>
          </button>
          {resolvedExpanded && resolved.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 opacity-70 transition-colors">
              <div className="flex gap-2">
                {item.keyTagPhotoUrl ? (
                  <img
                    src={item.keyTagPhotoUrl} alt="Key tag"
                    onClick={() => { hapticLight(); setLightboxUrl(item.keyTagPhotoUrl!); }}
                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer active:opacity-80 transition"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 transition-colors">
                    <span className="text-base">📦</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-700 dark:text-gray-300 text-base transition-colors">
                    {item.description ?? <span className="italic text-gray-400">No description</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                    {item.unitNumber ? `Unit ${item.unitNumber} · ` : ''}{fmtRelativeDate(item.foundAt)}
                  </p>
                  <p className="text-xs font-semibold text-green-600 dark:text-green-500 mt-0.5">✓ Returned</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none cursor-pointer hover:opacity-70 transition"
            onClick={() => setLightboxUrl(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Log Item Sheet */}
      {showSheet && (
        <LogLostFoundItemModal
          user={user}
          onClose={() => setShowSheet(false)}
          onSubmit={addLostFoundItem}
        />
      )}
    </div>
  );
}
