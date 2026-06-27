// Pure parser for a base64 image data URL → the parts Claude's image block needs.
// The FAB compresses a photo to a `data:image/jpeg;base64,...` URL (src/lib/image.ts);
// the proxy must split that into a media type + raw base64 for an Anthropic image
// block. Kept pure + co-located in api/_lib (tested, no I/O) like the other helpers.

const SUPPORTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export type ImageMediaType = (typeof SUPPORTED)[number];

export interface ParsedImage {
  mediaType: ImageMediaType;
  data: string; // raw base64, no data-URL prefix
}

/**
 * Parse a base64 image data URL. Returns null for anything that isn't a supported
 * base64 image (so a bad/empty/oversized-garbage value is simply ignored, never
 * forwarded to the model). Defensive: this runs on untrusted request input.
 */
export function parseImageDataUrl(input: unknown): ParsedImage | null {
  if (typeof input !== 'string') return null;
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(input.trim());
  if (!m) return null;
  const mediaType = m[1].toLowerCase();
  if (!(SUPPORTED as readonly string[]).includes(mediaType)) return null;
  if (m[2].length < 16) return null; // too small to be a real image — reject
  return { mediaType: mediaType as ImageMediaType, data: m[2] };
}
