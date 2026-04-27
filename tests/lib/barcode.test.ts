import { describe, expect, it } from 'vitest';
import { parseFleetBarcode } from '../../src/lib/barcode';

describe('parseFleetBarcode', () => {
  it('extracts the 7-digit unit from a 12-digit Canadian fleet barcode', () => {
    expect(parseFleetBarcode('012345678901')).toEqual({ ok: true, unit: '5678901' });
  });

  it('accepts a direct 7-digit unit number', () => {
    expect(parseFleetBarcode('5513130')).toEqual({ ok: true, unit: '5513130' });
  });

  it('trims scanner whitespace before parsing', () => {
    expect(parseFleetBarcode('  000005513130\n')).toEqual({ ok: true, unit: '5513130' });
  });

  it('rejects non-numeric barcode input', () => {
    expect(parseFleetBarcode('HRZ-5513130')).toEqual({ ok: false, reason: 'unrecognized' });
  });

  it('rejects numeric strings with the wrong length', () => {
    expect(parseFleetBarcode('123456')).toEqual({ ok: false, reason: 'unrecognized' });
    expect(parseFleetBarcode('12345678')).toEqual({ ok: false, reason: 'unrecognized' });
  });
});
