import { useState, useRef, useEffect } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { compressImage } from '../../lib/image';
import { LOST_FOUND_LOCATION_LABELS } from '../../types';
import type { LostFoundLocation, User } from '../../types';
import { PhotoSlot } from '../shared/PhotoSlot';
import { useVehicleByPlate } from '../../hooks/useVehicleByPlate';
import { describeKnownPlate, type KnownPlate } from '../../lib/vehicleByPlate';

const LOCATION_ORDER: LostFoundLocation[] = [
  'visor',
  'front_seat',
  'back_seat',
  'trunk',
  'under_seat',
  'other',
];

interface LogLostFoundItemModalProps {
  user: User | null;
  onClose: () => void;
  onSubmit: (item: {
    keyTagPhoto?: string;
    itemPhoto?: string;
    description?: string;
    location?: LostFoundLocation;
    licensePlate?: string;
    notes?: string;
  }) => Promise<boolean>;
}

export function LogLostFoundItemModal({
  user,
  onClose,
  onSubmit,
}: LogLostFoundItemModalProps) {
  useEscapeKey(onClose);
  const [step, setStep] = useState<1 | 2>(1);
  const [keyTagPhoto, setKeyTagPhoto] = useState<string | null>(null);
  const [itemPhoto, setItemPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LostFoundLocation | null>(null);
  const [licensePlate, setLicensePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const { resolve } = useVehicleByPlate();
  const [plateMatch, setPlateMatch] = useState<KnownPlate | null>(null);

  const keyTagCamRef = useRef<HTMLInputElement>(null);
  const itemCamRef = useRef<HTMLInputElement>(null);
  const itemGalleryRef = useRef<HTMLInputElement>(null);

  // Recognize the typed plate against the fleet + the cross-date registry memory,
  // so the logger sees whose car it is (or that it's new) before submitting.
  useEffect(() => {
    const p = licensePlate.trim();
    let cancelled = false;
    const lookup = p.length >= 4 ? resolve(p) : Promise.resolve(null);
    lookup.then(m => { if (!cancelled) setPlateMatch(m); });
    return () => { cancelled = true; };
  }, [licensePlate, resolve]);

  const handlePhotoCapture = (setter: (v: string) => void) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setter(await compressImage(file));
      e.target.value = '';
    };

  const handleSubmit = async () => {
    hapticMedium();
    setSubmitting(true);
    setSubmitError(false);
    const ok = await onSubmit({
      keyTagPhoto: keyTagPhoto ?? undefined,
      itemPhoto: itemPhoto ?? undefined,
      description: description.trim() || undefined,
      location: location ?? undefined,
      licensePlate: licensePlate.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!ok) {
      setSubmitError(true);
      return;
    }
    onClose();
  };

  const canAdvance = !!(keyTagPhoto || itemPhoto);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl transition-colors max-h-[90dvh] overflow-y-auto">
        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 transition-colors">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors">
            Log Found Item — Step {step} of 2
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer transition"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Step 1 — Photos */}
          {step === 1 && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                Photo the key tag — it captures unit, plate, and class in one shot. Then
                photo the item. At least one photo required.
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
                  onClick={() => {
                    hapticLight();
                    setStep(2);
                  }}
                  className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
                >
                  Next: Add Details →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setStep(2);
                  }}
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
                onClick={() => {
                  hapticLight();
                  setStep(1);
                }}
                className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer transition"
              >
                ← Back to photos
              </button>

              {/* Photo preview row */}
              {(keyTagPhoto || itemPhoto) && (
                <div className="flex gap-2">
                  {keyTagPhoto && (
                    <img
                      src={keyTagPhoto}
                      alt="Key tag"
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    />
                  )}
                  {itemPhoto && (
                    <img
                      src={itemPhoto}
                      alt="Item"
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    />
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Black garage door opener, visor…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              {/* Location pills */}
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
                        setLocation((l) => (l === loc ? null : loc));
                      }}
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  License plate
                </label>
                <input
                  type="text"
                  placeholder="e.g. LUR 224"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
                />
                {licensePlate.trim().length >= 4 ? (
                  plateMatch ? (
                    <p className="text-xs text-teal-700 dark:text-teal-400 mt-1">
                      ✓ Recognized{describeKnownPlate(plateMatch) ? ` — ${describeKnownPlate(plateMatch)}` : ' from a previous log'}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      New plate — we'll remember it for next time.
                    </p>
                  )
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                    Auto-matches unit number from vehicles on file
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Any additional context…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              {/* Logging as */}
              {user && (
                <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                  Logging as: <span className="font-semibold">{user.name}</span> ·{' '}
                  {user.role}
                </p>
              )}

              {submitError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3 transition-colors">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Couldn't save — check connection and try again.
                  </p>
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
  );
}
