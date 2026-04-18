/**
 * Parses a raw HID/camera barcode string into a clean unit number.
 *
 * Canadian fleet barcodes: 0 + area code (4) + unit number (7) = 12 digits.
 * Direct unit entry: 7 digits.
 * Anything else: unrecognized.
 */
export type BarcodeParseResult =
  | { ok: true;  unit: string }
  | { ok: false; reason: 'unrecognized' };

export function parseFleetBarcode(raw: string): BarcodeParseResult {
  const s = raw.trim();
  if (s.length === 12 && /^\d{12}$/.test(s)) {
    return { ok: true, unit: s.slice(-7) };
  }
  if (s.length === 7 && /^\d{7}$/.test(s)) {
    return { ok: true, unit: s };
  }
  return { ok: false, reason: 'unrecognized' };
}
