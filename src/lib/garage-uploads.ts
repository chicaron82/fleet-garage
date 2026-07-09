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
    supabase.storage.from('damage-photos').upload(path, blob, { contentType: 'image/jpeg' })
  );
  if (error) return null;
  return supabase.storage.from('damage-photos').getPublicUrl(path).data.publicUrl;
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
    supabase.storage.from('issue-bucket').upload(path, blob, { contentType: 'image/jpeg' })
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
