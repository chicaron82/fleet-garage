// Step 1 of the Log-Found-Item sheet — the key-tag + item photos. Extracted from
// LogLostFoundItemModal (330-cap split); state lives in useLostFoundItemForm.
import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';
import { PhotoSlot } from '../shared/PhotoSlot';
import type { LostFoundForm } from '../../hooks/useLostFoundItemForm';

export function LostFoundPhotoStep({ form }: { form: LostFoundForm }) {
  // Refs live in the component that uses them, not the form object (react-hooks/refs).
  const keyTagCamRef   = useRef<HTMLInputElement>(null);
  const itemCamRef     = useRef<HTMLInputElement>(null);
  const itemGalleryRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
        Photo the key tag — it captures unit, plate, and class in one shot. Then
        photo the item. At least one photo required.
      </p>
      <div className="flex gap-6">
        <PhotoSlot
          label="Key tag"
          photo={form.keyTagPhoto}
          onCapture={form.handlePhotoCapture(form.setKeyTagPhoto, (p) => void form.keytag.scanPhoto(p, form.setLicensePlate))}
          onClear={() => form.setKeyTagPhoto(null)}
          cameraRef={keyTagCamRef}
        />
        <PhotoSlot
          label="Item"
          photo={form.itemPhoto}
          onCapture={form.handlePhotoCapture(form.setItemPhoto)}
          onGallery={form.handlePhotoCapture(form.setItemPhoto)}
          onClear={() => form.setItemPhoto(null)}
          cameraRef={itemCamRef}
          galleryRef={itemGalleryRef}
        />
      </div>
      <div className="space-y-2 pt-1">
        <button
          type="button"
          disabled={!form.canAdvance}
          onClick={() => {
            hapticLight();
            form.setStep(2);
          }}
          className="w-full py-3 bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          Next: Add Details →
        </button>
        <button
          type="button"
          onClick={() => {
            hapticLight();
            form.setStep(2);
          }}
          className="w-full py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition cursor-pointer"
        >
          Skip to details only
        </button>
      </div>
    </>
  );
}
