import type { RefObject } from 'react';

interface PhotoSlotProps {
  label: string;
  photo: string | null;
  onCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGallery?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  cameraRef: RefObject<HTMLInputElement | null>;
  galleryRef?: RefObject<HTMLInputElement | null>;
}

export function PhotoSlot({
  label,
  photo,
  onCapture,
  onGallery,
  onClear,
  cameraRef,
  galleryRef,
}: PhotoSlotProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {label}
      </p>
      {photo ? (
        <div className="relative w-24 h-24">
          <img
            src={photo}
            alt={label}
            className="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold cursor-pointer"
          >
            ×
          </button>
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCapture}
        className="hidden"
      />
      {galleryRef && onGallery && (
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={onGallery}
          className="hidden"
        />
      )}
    </div>
  );
}
