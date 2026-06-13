import { useRef } from 'react';

interface Props {
  photos: string[];
  maxPhotos: number;
  bypassActive: boolean;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}

/** Photo grid + camera/gallery inputs for the re-hold form. Required unless a
 *  photo-bypass is active (odour, PM, no-new-damage, sale-car return). */
export function ReHoldPhotosField({ photos, maxPhotos, bypassActive, onAdd, onRemove }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        {bypassActive
          ? `Photos (optional · max ${maxPhotos})`
          : `Photos * (required · max ${maxPhotos})`}
      </label>
      <div className="flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative">
            <img
              src={src}
              alt={`New damage photo ${i + 1}`}
              className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-fg-yellow hover:text-yellow-500 transition cursor-pointer gap-1"
            >
              <span className="text-lg leading-none">📷</span>
              <span className="text-xs font-medium">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="h-20 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-fg-yellow hover:text-yellow-500 transition cursor-pointer gap-1"
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
        onChange={onAdd}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onAdd}
        className="hidden"
      />
      {photos.length === 0 && !bypassActive && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          At least one photo required.
        </p>
      )}
    </div>
  );
}
