import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoutedProp } from '../../hooks/useRoutedProp';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { hapticLight } from '../../lib/haptics';
import type { LostFoundStatus } from '../../types';
import { canActionLostFound } from '../../types';
import { fmtRelativeDate, daysHeld } from '../../lib/lostFoundDate';
import { LostFoundCard } from './LostFoundCard';
import { LogLostFoundItemModal } from './LogLostFoundItemModal';
import { ModuleHeader } from '../shared/ModuleHeader';
import { PrimaryAction } from '../shared/PrimaryAction';

// `prefillPlate` arrives from the scan-router (scan a tag → "Log lost & found"): open the log
// sheet straight away with the plate already filled, so the scan hands off mid-flow.
export function LostAndFoundView({ prefillPlate, prefillNonce }: { prefillPlate?: string; prefillNonce?: number } = {}) {
  const { user } = useAuth();
  const { lostFoundItems, addLostFoundItem, updateLostFoundStatus, updateLostFoundItem, loadError, reload } = useLostFoundContext();

  const [query, setQuery]                   = useState('');
  const [lightboxUrl, setLightboxUrl]       = useState<string | null>(null);
  const [showSheet, setShowSheet]           = useState(!!prefillPlate);
  // WHY the sheet opened, not just WHETHER a plate is around. The scanned plate lingers on the screen
  // after a scan, so keying "open on item-entry" off the plate's presence leaked into the manual
  // "+ Log" button — it inherited the stale plate and skipped Step 1 (found 2026-07-21). A scan-open
  // sets this true (→ prefill + Step 2); "+ Log" sets it false (→ clean, full two-step from Step 1).
  const [scanOpened, setScanOpened]         = useState(!!prefillPlate);
  // Mount-only otherwise: scanning a tag while ALREADY on Lost & Found re-navigates to the same
  // mounted component, so the sheet never opened and the button looked dead. Keyed on the scan
  // NONCE (not the plate value) so a repeat scan of the same tag re-opens the sheet — a value key
  // no-ops the second scan. Same class as the movement-log prefill bug (9d1535f, then 2026-07-21).
  useRoutedProp(prefillNonce, () => { setShowSheet(true); setScanOpened(true); });
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const [updatingId, setUpdatingId]         = useState<string | null>(null);

  if (loadError) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load lost &amp; found. Check your connection.</p>
        <button
          type="button"
          onClick={reload}
          className="px-4 py-2 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi text-black text-sm font-semibold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // Terminal states leave the holding list. canAction is computed per-item below
  // (the 30-day age unlock is item-specific, not a single view-wide flag).
  const holding = lostFoundItems.filter(i => i.status !== 'returned' && i.status !== 'disposed');
  const resolved = lostFoundItems.filter(i => i.status === 'returned' || i.status === 'disposed');

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
    <div className="py-6 space-y-5">
      {/* Header */}
      <ModuleHeader
        title="Lost & Found"
        subtitle={`${holding.length} item${holding.length !== 1 ? 's' : ''} holding`}
      />

      {/* Search + log */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by description, plate, notes…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none cursor-pointer transition">
              ✕
            </button>
          )}
        </div>
        <PrimaryAction label="Log" aria-label="Log a found item" onClick={() => { setScanOpened(false); setShowSheet(true); }} />
      </div>

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
                canAction={user ? canActionLostFound(user.role, daysHeld(item.foundAt)) : false}
                onContactCustomer={() => handleStatusUpdate(item.id, 'customer_contacted')}
                onMarkReturned={() => handleStatusUpdate(item.id, 'returned')}
                onDispose={() => handleStatusUpdate(item.id, 'disposed')}
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
                    loading="lazy"
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
                  {item.status === 'disposed'
                    ? <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">🗑️ Thrown out</p>
                    : <p className="text-xs font-semibold text-green-600 dark:text-green-500 mt-0.5">✓ Returned</p>}
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
          initialPlate={scanOpened ? prefillPlate : undefined}
          initialPlateNonce={scanOpened ? prefillNonce : undefined}
          onClose={() => setShowSheet(false)}
          onSubmit={addLostFoundItem}
        />
      )}
    </div>
  );
}
