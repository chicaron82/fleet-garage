import { describe, it, expect } from 'vitest';
import { base64ToBlob } from '../../src/lib/garage-uploads';

// Only base64ToBlob is pure; the rest of garage-uploads is Supabase Storage I/O.

describe('base64ToBlob', () => {
  it('decodes a data URL to a Blob with the declared mime type', async () => {
    const blob = base64ToBlob('data:text/plain;base64,SGk='); // "Hi"
    expect(blob.type).toBe('text/plain');
    expect(blob.size).toBe(2);
    expect(await blob.text()).toBe('Hi');
  });

  it('defaults to image/jpeg when the header has no mime type', () => {
    const blob = base64ToBlob('data:;base64,SGk=');
    expect(blob.type).toBe('image/jpeg');
  });
});
