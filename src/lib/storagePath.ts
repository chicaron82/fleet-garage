// Extract a Supabase Storage object path from its public URL, so a photo can be DELETED
// from the bucket (not just dereferenced). A public URL looks like
//   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path...>
// and `storage.from(bucket).remove([path])` needs the `<path...>` part. Pure — the actual
// remove is I/O (garage-uploads.deleteDamagePhotos). See docs/ticket-holds-history-edit.md.
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split('?')[0]; // drop any query (e.g. a transform)
  return path || null;
}
