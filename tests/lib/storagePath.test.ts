import { describe, it, expect } from 'vitest';
import { storagePathFromPublicUrl } from '../../src/lib/storagePath';

describe('storagePathFromPublicUrl', () => {
  it('extracts the object path from a damage-photos public URL', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/damage-photos/hold-42/9f8e.jpg';
    expect(storagePathFromPublicUrl(url, 'damage-photos')).toBe('hold-42/9f8e.jpg');
  });

  it('drops a trailing query string (transform params)', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/damage-photos/h/p.jpg?width=200';
    expect(storagePathFromPublicUrl(url, 'damage-photos')).toBe('h/p.jpg');
  });

  it('returns null when the bucket is not in the URL', () => {
    expect(storagePathFromPublicUrl('https://x/storage/v1/object/public/other/p.jpg', 'damage-photos')).toBeNull();
  });

  it('returns null when there is no path after the bucket', () => {
    expect(storagePathFromPublicUrl('https://x/damage-photos/', 'damage-photos')).toBeNull();
  });
});
