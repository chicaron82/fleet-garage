import { useEffect } from 'react';
import type { RefObject } from 'react';
import { parseFleetBarcode } from '../lib/barcode';
import { hapticMedium } from '../lib/haptics';

interface Options {
  inputRef: RefObject<HTMLInputElement | null>;
  onUnit: (unitNumber: string) => void;
  onUnrecognized: () => void;
}

/**
 * Intercepts HID barcode scanner input on a focused text field.
 * Delegates parsing to parseFleetBarcode in lib/barcode.ts.
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

      const result = parseFleetBarcode(raw);
      if (result.ok) {
        el.value = result.unit;
        hapticMedium();
        onUnit(result.unit);
      } else {
        el.select();
        onUnrecognized();
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [inputRef, onUnit, onUnrecognized]);
}

