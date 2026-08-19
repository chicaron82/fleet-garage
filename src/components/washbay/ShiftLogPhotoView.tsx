// The board photo, read back — the ONE renderer for both shift logs (migrations/116).
//
// Why it's a shared component and not two blocks: the photo field was added to the hand-off form
// and the closing form in the same commit, and only the closing log ever got a way to look at it.
// The hand-off photos uploaded fine, saved fine, mapped fine, and were seen by nobody. A field that
// writes with no matching read is invisible to every gate — the tests pass, the upload succeeds,
// and the feature is half a feature. One renderer means the next log that gains a photo can't
// quietly ship the write-only half.
//
// FULL WIDTH, never a thumbnail. Aaron photographs the key board: at thumbnail size you cannot
// count keys, and counting keys is the entire reason the photo exists. A photo nobody can read
// back is write-only in the way that matters even when it IS on screen.
export function ShiftLogPhotoView({ url, alt, caption }: {
  url: string | null | undefined;
  alt: string;
  caption: string;
}) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={alt}
        className="w-full max-h-56 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
      />
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">📷 {caption} — tap to open full size</p>
    </a>
  );
}
