import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { compressImage } from '../lib/image';
import type { LostFoundItem, LostFoundLocation, LostFoundStatus } from '../types';
import { LOST_FOUND_LOCATION_LABELS } from '../types';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return `Today ${fmtTime(iso)}`;
  if (days === 1) return `Yesterday ${fmtTime(iso)}`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const LOCATION_ORDER: LostFoundLocation[] = ['visor', 'front_seat', 'back_seat', 'trunk', 'under_seat', 'other'];

interface CardProps {
  item: LostFoundItem;
  updating: boolean;
  onContactCustomer: () => void;
  onMarkReturned: () => void;
}

function LostFoundCard({ item, updating, onContactCustomer, onMarkReturned }: CardProps) {
  const vehicleLabel = item.unitNumber
    ? `Unit ${item.unitNumber}${item.licensePlate ? ` · ${item.licensePlate}` : ''}`
    : item.licensePlate ?? null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
      {/* Photos row */}
      <div className="flex gap-2">
        {item.keyTagPhotoUrl ? (
          <img src={item.keyTagPhotoUrl} alt="Key tag" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 transition-colors">
            <span className="text-lg">🏷️</span>
          </div>
        )}
        {item.itemPhotoUrl ? (
          <img src={item.itemPhotoUrl} alt="Item" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 transition-colors">
            <span className="text-lg">📦</span>
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm transition-colors">
            {item.description ?? <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
          </p>
          {(item.location || vehicleLabel) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
              {item.location && LOST_FOUND_LOCATION_LABELS[item.location]}
              {item.location && vehicleLabel && ' · '}
              {vehicleLabel}
            </p>
          )}
          {item.vehicleMake && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">{item.vehicleMake}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
            Found by <span className="font-medium text-gray-600 dark:text-gray-400">{item.foundByName}</span> · {fmtRelativeDate(item.foundAt)}
          </p>
        </div>
      </div>

      {/* Status indicator for customer_contacted */}
      {item.status === 'customer_contacted' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg px-3 py-2 transition-colors">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">📞 Customer contacted</p>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic transition-colors">"{item.notes}"</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
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
    </div>
  );
}

// ── Photo slot ────────────────────────────────────────────────────────────────

interface PhotoSlotProps {
  label: string;
  photo: string | null;
  onCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGallery?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  galleryRef?: React.RefObject<HTMLInputElement | null>;
}

function PhotoSlot({ label, photo, onCapture, onGallery, onClear, cameraRef, galleryRef }: PhotoSlotProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">{label}</p>
      {photo ? (
        <div className="relative w-24 h-24">
          <img src={photo} alt={label} className="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold cursor-pointer"
          >×</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5"
          >
            <span className="text-lg leading-none">📷</span>
            <span className="text-[10px] leading-none">Camera</span>
          </button>
          {galleryRef && onGallery && (
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5"
            >
              <span className="text-lg leading-none">🖼️</span>
              <span className="text-[10px] leading-none">Gallery</span>
            </button>
          )}
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onCapture} className="hidden" />
      {galleryRef && onGallery && (
        <input ref={galleryRef} type="file" accept="image/*" onChange={onGallery} className="hidden" />
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LostAndFoundView() {
  const { user } = useAuth();
  const { lostFoundItems, addLostFoundItem, updateLostFoundStatus } = useGarage();

  const [showSheet, setShowSheet]           = useState(false);
  const [step, setStep]                     = useState<1 | 2>(1);
  const [keyTagPhoto, setKeyTagPhoto]       = useState<string | null>(null);
  const [itemPhoto, setItemPhoto]           = useState<string | null>(null);
  const [description, setDescription]       = useState('');
  const [location, setLocation]             = useState<LostFoundLocation | null>(null);
  const [licensePlate, setLicensePlate]     = useState('');
  const [notes, setNotes]                   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState(false);
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const [updatingId, setUpdatingId]         = useState<string | null>(null);

  const keyTagCamRef    = useRef<HTMLInputElement>(null);
  const itemCamRef      = useRef<HTMLInputElement>(null);
  const itemGalleryRef  = useRef<HTMLInputElement>(null);

  const holding = lostFoundItems.filter(i => i.status !== 'returned');
  const resolved = lostFoundItems.filter(i => i.status === 'returned');

  const handlePhotoCapture = (setter: (v: string) => void) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setter(await compressImage(file));
      e.target.value = '';
    };

  const resetSheet = () => {
    setStep(1);
    setKeyTagPhoto(null);
    setItemPhoto(null);
    setDescription('');
    setLocation(null);
    setLicensePlate('');
    setNotes('');
    setSubmitError(false);
    setSubmitting(false);
  };

  const handleClose = () => { resetSheet(); setShowSheet(false); };

  const handleSubmit = async () => {
    hapticMedium();
    setSubmitting(true);
    setSubmitError(false);
    const ok = await addLostFoundItem({
      keyTagPhoto:  keyTagPhoto  ?? undefined,
      itemPhoto:    itemPhoto    ?? undefined,
      description:  description.trim()  || undefined,
      location:     location    ?? undefined,
      licensePlate: licensePlate.trim() || undefined,
      notes:        notes.trim()        || undefined,
    });
    setSubmitting(false);
    if (!ok) { setSubmitError(true); return; }
    handleClose();
  };

  const handleStatusUpdate = async (id: string, status: LostFoundStatus) => {
    hapticLight();
    setUpdatingId(id);
    await updateLostFoundStatus(id, status);
    setUpdatingId(null);
  };

  const canAdvance = !!(keyTagPhoto || itemPhoto);

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

      {/* Holding items */}
      {holding.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Holding</p>
          {holding.map(item => (
            <LostFoundCard
              key={item.id}
              item={item}
              updating={updatingId === item.id}
              onContactCustomer={() => handleStatusUpdate(item.id, 'customer_contacted')}
              onMarkReturned={() => handleStatusUpdate(item.id, 'returned')}
            />
          ))}
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
                  <img src={item.keyTagPhotoUrl} alt="Key tag" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 transition-colors">
                    <span className="text-base">📦</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-700 dark:text-gray-300 text-sm transition-colors">
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

      {/* Log Item Sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl transition-colors max-h-[90dvh] overflow-y-auto">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors">
                Log Found Item — Step {step} of 2
              </p>
              <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition">×</button>
            </div>

            <div className="p-4 space-y-5">
              {/* Step 1 — Photos */}
              {step === 1 && (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                    Photo the key tag — it captures unit, plate, and class in one shot. Then photo the item. At least one photo required.
                  </p>
                  <div className="flex gap-6">
                    <PhotoSlot
                      label="Key tag"
                      photo={keyTagPhoto}
                      onCapture={handlePhotoCapture(setKeyTagPhoto)}
                      onClear={() => setKeyTagPhoto(null)}
                      cameraRef={keyTagCamRef}
                    />
                    <PhotoSlot
                      label="Item"
                      photo={itemPhoto}
                      onCapture={handlePhotoCapture(setItemPhoto)}
                      onGallery={handlePhotoCapture(setItemPhoto)}
                      onClear={() => setItemPhoto(null)}
                      cameraRef={itemCamRef}
                      galleryRef={itemGalleryRef}
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={!canAdvance}
                      onClick={() => { hapticLight(); setStep(2); }}
                      className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
                    >
                      Next: Add Details →
                    </button>
                    <button
                      type="button"
                      onClick={() => { hapticLight(); setStep(2); }}
                      className="w-full py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition cursor-pointer"
                    >
                      Skip to details only
                    </button>
                  </div>
                </>
              )}

              {/* Step 2 — Details */}
              {step === 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); setStep(1); }}
                    className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition"
                  >
                    ← Back to photos
                  </button>

                  {/* Photo preview row */}
                  {(keyTagPhoto || itemPhoto) && (
                    <div className="flex gap-2">
                      {keyTagPhoto && <img src={keyTagPhoto} alt="Key tag" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />}
                      {itemPhoto   && <img src={itemPhoto}   alt="Item"    className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />}
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Black garage door opener, visor…"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                    />
                  </div>

                  {/* Location pills */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Location found</label>
                    <div className="flex flex-wrap gap-2">
                      {LOCATION_ORDER.map(loc => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => { hapticLight(); setLocation(l => l === loc ? null : loc); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                            location === loc
                              ? 'bg-yellow-400 border-yellow-400 text-black'
                              : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                          }`}
                        >
                          {LOST_FOUND_LOCATION_LABELS[loc]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* License plate */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License plate</label>
                    <input
                      type="text"
                      placeholder="e.g. LUR 224"
                      value={licensePlate}
                      onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">Auto-matches unit number from vehicles on file</p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Any additional context…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                    />
                  </div>

                  {/* Logging as */}
                  {user && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                      Logging as: <span className="font-semibold">{user.name}</span> · {user.role}
                    </p>
                  )}

                  {submitError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3 transition-colors">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    {submitting ? 'Saving…' : 'Submit Found Item'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
