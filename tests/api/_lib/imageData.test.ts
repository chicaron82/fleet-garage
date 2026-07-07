import { describe, it, expect } from 'vitest';
import { parseImageDataUrl, parseDocumentDataUrl } from '../../../api/_lib/imageData';

const B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA',  // long-enough dummy base64
  jpegUrl = `data:image/jpeg;base64,${B64}`;

describe('parseImageDataUrl', () => {
  it('parses a supported jpeg data URL into media type + raw base64', () => {
    expect(parseImageDataUrl(jpegUrl)).toEqual({ mediaType: 'image/jpeg', data: B64 });
  });

  it('accepts png/webp/gif', () => {
    for (const t of ['image/png', 'image/webp', 'image/gif']) {
      expect(parseImageDataUrl(`data:${t};base64,${B64}`)?.mediaType).toBe(t);
    }
  });

  it('rejects an unsupported media type', () => {
    expect(parseImageDataUrl(`data:image/svg+xml;base64,${B64}`)).toBeNull();
    expect(parseImageDataUrl(`data:application/pdf;base64,${B64}`)).toBeNull();
  });

  it('rejects non-strings, non-data-URLs, and too-small payloads', () => {
    expect(parseImageDataUrl(undefined)).toBeNull();
    expect(parseImageDataUrl(123)).toBeNull();
    expect(parseImageDataUrl('https://example.com/x.jpg')).toBeNull();
    expect(parseImageDataUrl('data:image/jpeg;base64,AAA')).toBeNull(); // < 16 chars
    expect(parseImageDataUrl('')).toBeNull();
  });
});

describe('parseDocumentDataUrl', () => {
  it('accepts an image (with media type) or a PDF (kind pdf)', () => {
    expect(parseDocumentDataUrl(jpegUrl)).toEqual({ kind: 'image', mediaType: 'image/jpeg', data: B64 });
    expect(parseDocumentDataUrl(`data:application/pdf;base64,${B64}`)).toEqual({ kind: 'pdf', data: B64 });
  });

  it('rejects unsupported types + garbage', () => {
    expect(parseDocumentDataUrl(`data:application/zip;base64,${B64}`)).toBeNull();
    expect(parseDocumentDataUrl(undefined)).toBeNull();
    expect(parseDocumentDataUrl('not-a-data-url')).toBeNull();
  });
});
