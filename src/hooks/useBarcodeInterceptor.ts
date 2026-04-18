import { useEffect } from 'react';
import type { RefObject } from 'react';

interface Options {
  inputRef: RefObject<HTMLInputElement | null>;
  onUnit: (unitNumber: string) => void;
  onUnrecognized: () => void;
}

/**
 * Intercepts HID barcode scanner input on a focused text field.
 *
 * Canadian fleet barcodes are 12 chars: 0 + area code (4) + unit number (7).
 * Scanner fires keystrokes then Enter. We slice the last 7 as the unit number.
 * Manual 7-digit entry also accepted. Anything else → onUnrecognized.
 */
export function useBarcodeInterceptor({ inputRef, onUnit, onUnrecognized }: Options) {
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const raw = el.value.trim();
      if (!raw) return;

      if (raw.length === 12 && /^\d{12}$/.test(raw)) {
        // Standard Canadian barcode: 0 + area code (4) + unit number (7)
        const unit = raw.slice(-7);
        el.value = unit;
        onUnit(unit);
      } else if (raw.length === 7 && /^\d{7}$/.test(raw)) {
        // Direct unit number entry
        onUnit(raw);
      } else {
        // Unrecognized format — highlight for manual correction
        el.select();
        onUnrecognized();
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [inputRef, onUnit, onUnrecognized]);
}
