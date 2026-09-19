import { supabase, writeWithRefresh } from './supabase';
import { storagePathFromPublicUrl } from './storagePath';
import type { UserRole } from '../types';
import type { NotificationSeverity } from '../data/notifications';
import type { Json } from '../types/database.types';

export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** ⭐⭐⭐ A YEAR, NOT AN HOUR — and only on the buckets whose paths are WRITE-ONCE.
 *
 *  Supabase defaults uploads to `cacheControl: '3600'`, so every browser re-fetched every photo it
 *  displayed once an hour. Nothing was broken and nothing was near a size limit (34 MB of a 500 MB
 *  database, 121 MB of 1 GB storage) — the org still blew its **cached egress** quota, because
 *  110 MB of damage photos re-served often enough is 5 GB of bandwidth. A default nobody changed.
 *
 *  ⚠️ IT IS DELIBERATELY NOT APPLIED TO `lost-found-photos` OR `shift-log-photos`. Those upload with
 *  `upsert: true` to a FIXED path, so the same URL is expected to return different bytes after a
 *  re-upload (see uploadShiftLogPhoto below — overwriting rather than orphaning is the whole design).
 *  A year-long cache on a mutable URL serves a stale photo for a year. They are ~10 MB of the 121,
 *  so the hour they keep costs nothing worth this risk.
 *
 *  The rule for a new bucket: unique path per upload → LONG_CACHE. Overwritable path → leave it. */
const LONG_CACHE = '31536000';

const UPLOAD_TIMEOUT_MS = 15_000;

function withUploadTimeout<T extends { error: unknown }>(
  promise: Promise<T>,
): Promise<T> {
  const timeout = new Promise<T>(resolve =>
    setTimeout(() => resolve({ error: new Error('Upload timeout') } as T), UPLOAD_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

export async function uploadPhoto(base64: string, holdId: string): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${holdId}/${crypto.randomUUID()}.jpg`;
  const { error } = await withUploadTimeout(
    supabase.storage.from('damage-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: LONG_CACHE })
  );
  if (error) return null;
  return supabase.storage.from('damage-photos').getPublicUrl(path).data.publicUrl;
}

/** Several photos → the ones that made it, and an honest count of the ones that didn't.
 *
 * ⭐⭐ THE UPLOAD HALF OF `compressBatch` (2026-09-19, docs/September/ticket-photos-that-never-uploaded.md).
 * A photo that could not be READ has said so since `2eb56cb`; a photo that could not be UPLOADED
 * said nothing — `addHold` filtered the nulls out and wrote the hold with whatever survived. The
 * operator is standing at the car with one bar of signal when that happens, and the photo IS the
 * record ([[reference_new_vs_preexisting_damage]]).
 *
 * ⚠️ ONE RETRY, then report. `uploadPhoto`'s failure mode here is a 15s TIMEOUT that resolves — a
 * transient, and a second attempt on a fresh path is the cheapest thing that actually recovers it.
 * A retry LOOP would hold a damage form hostage to a dead connection, so it stops at two.
 *
 * ⚠️ `failedPhotos` carries the base64s back OUT, not just a count: the caller can re-offer them
 * against the hold that now exists (`addPhotosToHold`) instead of asking him to shoot the car again.
 */
export async function uploadPhotos(
  base64s: readonly string[],
  holdId: string,
): Promise<{ urls: string[]; failed: number; failedPhotos: string[] }> {
  // ⚠️⚠️ ORDER IS LOAD-BEARING, so the results are written back BY INDEX and never appended.
  // `useNewHold` pins the card photo with `coverPhotoUrlFor(pinnedPhotoIndex, photos, photoUrls)`:
  // it lines the returned URLs up against the photos he picked from. A retry that appended its
  // successes at the end would keep the COUNTS matching (so the guard would pass) while pinning
  // the wrong picture — a silent wrong answer in place of the silent loss this fix is about.
  const slots: (string | null)[] = base64s.map(() => null);

  const attempt = async (idxs: readonly number[]): Promise<number[]> => {
    const results = await Promise.all(
      idxs.map(async i => {
        const b = base64s[i];
        return { i, url: b.startsWith('data:') ? await uploadPhoto(b, holdId) : b };
      }),
    );
    const stillPending: number[] = [];
    for (const { i, url } of results) {
      if (url === null) stillPending.push(i);
      else slots[i] = url;
    }
    return stillPending;
  };

  let pending = await attempt(base64s.map((_, i) => i));
  if (pending.length > 0) pending = await attempt(pending);

  return {
    urls: slots.filter((u): u is string => u !== null),
    failed: pending.length,
    failedPhotos: pending.map(i => base64s[i]),
  };
}

/** Delete damage photos from the bucket by their public URLs. Best-effort: a failed storage
 *  remove does NOT throw — an orphaned file is recoverable, a blocked hold/photo edit isn't.
 *  Callers do the DB change (the source of truth) and call this for the storage cleanup. */
export async function deleteDamagePhotos(urls: string[]): Promise<void> {
  const paths = urls
    .map(u => storagePathFromPublicUrl(u, 'damage-photos'))
    .filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try { await supabase.storage.from('damage-photos').remove(paths); } catch { /* orphan, not a blocker */ }
}

export async function uploadIssuePhoto(base64: string, issueId: string): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${issueId}/photo.jpg`;
  const { error } = await withUploadTimeout(
    supabase.storage.from('issue-bucket').upload(path, blob, { contentType: 'image/jpeg', cacheControl: LONG_CACHE })
  );
  if (error) return null;
  return supabase.storage.from('issue-bucket').getPublicUrl(path).data.publicUrl;
}

export async function uploadLostFoundPhoto(base64: string, itemId: string, slot: 'key-tag' | 'item'): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${itemId}/${slot}.jpg`;
  const { error } = await withUploadTimeout(
    supabase.storage.from('lost-found-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  );
  if (error) return null;
  return supabase.storage.from('lost-found-photos').getPublicUrl(path).data.publicUrl;
}

// The two dominant notification audiences (16 of ~25 call sites). The other
// role combinations are deliberate per-event choices — name a new constant
// only when a combination earns a third use, don't normalize them away.
export const NOTIFY_MGMT: UserRole[] = ['Branch Manager', 'Operations Manager'];
export const NOTIFY_MGMT_WIDE: UserRole[] = [...NOTIFY_MGMT, 'City Manager'];

export async function pushNotification(
  branchId: string,
  roles: UserRole[],
  icon: string,
  text: string,
  severity: NotificationSeverity = 'info',
  metadata?: Record<string, unknown>,
  recipientUserId?: string,
): Promise<void> {
  await writeWithRefresh(() => supabase.from('notifications').insert({
    branch_id:         branchId,
    recipient_roles:   roles as string[],
    icon,
    text,
    severity,
    metadata:          (metadata ?? null) as unknown as Json,
    recipient_user_id: recipientUserId ?? null,
  }));
}

/** A shift log's optional context photo — the key board at handoff or at close.
 *
 *  `lot_status` is a judgment word; this is the measurement behind it (migration 116). Pathed by
 *  the log's own key (`handoff/<id>` or `closing/<branch>-<date>`) so a re-upload for the same
 *  shift overwrites rather than orphaning — hence `upsert: true`, and why the bucket has an UPDATE
 *  policy but deliberately no DELETE one.
 *
 *  Returns null on any failure. The caller MUST treat that as "log it without a photo": a shift
 *  log that fails because a photo upload timed out would lose the counts, which are the part that
 *  can never be reconstructed. */
export async function uploadShiftLogPhoto(base64: string, logKey: string): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${logKey}.jpg`;
  const { error } = await withUploadTimeout(
    supabase.storage.from('shift-log-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  );
  if (error) return null;
  return supabase.storage.from('shift-log-photos').getPublicUrl(path).data.publicUrl;
}
