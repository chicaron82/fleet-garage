// The composer's attached-image preview — a horizontal strip of thumbnails, each
// removable, for Effie's multi-image attach (a batch of keytags, several damage
// angles). One image is just a strip of one; the send path treats them uniformly.
export function EffieImageStrip({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative">
          <img
            src={src}
            alt={`Attached ${i + 1} of ${images.length}`}
            className="h-12 w-12 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove photo ${i + 1}`}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] leading-none text-white shadow hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
