import { useState, useRef } from 'react';
import { hapticLight } from '../lib/haptics';
import { compressImage } from '../lib/image';
import type { Hold, User } from '../types';

const MAX_PHOTOS = 4;

interface PriorDamageReHoldFormProps {
  vehicleId: string;
  mostRecent: Hold;
  user: User;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (notes: string, photos: string[]) => Promise<void>;
  getName: (id: string) => string;
}

export function PriorDamageReHoldForm({
  mostRecent,
  user,
  submitting,
  onCancel,
  onSubmit,
  getName,
}: PriorDamageReHoldFormProps) {
  const [reHoldNotes, setReHoldNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [reattachPhotos, setReattachPhotos] = useState(true);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    const compressed = await Promise.all(toAdd.map(compressImage));
    setPhotos((prev) => [...prev, ...compressed]);
    setReattachPhotos(false); // new photos take precedence
    e.target.value = '';
  };

  const handleLocalSubmit = async () => {
    const originalPhotos = mostRecent?.photos ?? [];
    const photosToSubmit =
      reattachPhotos && photos.length === 0 ? originalPhotos : photos;
    await onSubmit(reHoldNotes, photosToSubmit);
  };

  const originalPhotos = mostRecent?.photos ?? [];
  const hasOriginalPhotos = originalPhotos.length > 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
        Prior Damage — Confirm Still Present
      </p>

      {/* Inherited damage description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Damage on File
        </label>
        <div className="px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
          {mostRecent.damageDescription}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Any change in condition since release…"
          value={reHoldNotes}
          onChange={(e) => setReHoldNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
        />
      </div>

      {/* Photos */}
      <div className="space-y-2">
        {hasOriginalPhotos && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reattachPhotos}
                onChange={(e) => {
                  hapticLight();
                  setReattachPhotos(e.target.checked);
                  if (e.target.checked) setPhotos([]);
                }}
                className="w-4 h-4 rounded accent-yellow-400"
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Reattach photos from original hold ({originalPhotos.length} photo
                {originalPhotos.length !== 1 ? 's' : ''})
              </span>
            </label>
            {reattachPhotos && (
              <div className="flex gap-2 flex-wrap">
                {originalPhotos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Original hold photo ${i + 1}`}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700 opacity-75"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* New photo inputs */}
        {(!reattachPhotos || !hasOriginalPhotos) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {hasOriginalPhotos
                ? 'Or add new photos'
                : `Photos * (required · max ${MAX_PHOTOS})`}
            </p>
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`Damage photo ${i + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
                  >
                    <span className="text-lg leading-none">📷</span>
                    <span className="text-xs font-medium">Take Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
                  >
                    <span className="text-lg leading-none">🖼</span>
                    <span className="text-xs font-medium">Gallery</span>
                  </button>
                </div>
              )}
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoAdd}
              className="hidden"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoAdd}
              className="hidden"
            />
            {photos.length === 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                At least one photo required to confirm damage.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Flagging as: <span className="font-semibold">{getName(user.id)}</span> ·{' '}
        {user.role}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={
            (!(reattachPhotos && (mostRecent?.photos ?? []).length > 0) &&
              photos.length === 0) ||
            submitting
          }
          onClick={handleLocalSubmit}
          className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Confirm Re-hold'}
        </button>
      </div>
    </div>
  );
}
