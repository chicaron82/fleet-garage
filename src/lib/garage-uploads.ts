import { supabase } from './supabase';
import type { UserRole } from '../types';
import type { NotificationSeverity } from '../data/notifications';

export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadPhoto(base64: string, holdId: string): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${holdId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('damage-photos')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) return null;
  return supabase.storage.from('damage-photos').getPublicUrl(path).data.publicUrl;
}

export async function uploadLostFoundPhoto(base64: string, itemId: string, slot: 'key-tag' | 'item'): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${itemId}/${slot}.jpg`;
  const { error } = await supabase.storage
    .from('lost-found-photos')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) return null;
  return supabase.storage.from('lost-found-photos').getPublicUrl(path).data.publicUrl;
}

export async function pushNotification(
  branchId: string,
  roles: UserRole[],
  icon: string,
  text: string,
  severity: NotificationSeverity = 'info',
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from('notifications').insert({
    branch_id: branchId,
    recipient_roles: roles,
    icon,
    text,
    severity,
    metadata,
  });
}
