import { describe, it, expect } from 'vitest';
import { failedScanCarryover, readWithTypedKey } from '../../src/lib/failedScanCarryover';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// ⭐⭐ THE PHOTO THAT SURVIVES A FAILED READ (2026-09-20,
// docs/September/ticket-a-failed-read-is-not-a-verdict.md). Aaron was mining his camera roll for
// tags FG doesn't hold: *"the scan was merely so it would attach the keytag to the record that has
// it missing. and the scan would fill in the VIN since the info is on the tag."* His tag lay
// SIDEWAYS in the photo, the read produced a class code and no plate, and typing the plate himself
// dropped the photo — the one artifact that had not failed.

const SIDEWAYS: KeytagRead = { classCode: 'CCLM', vinLast9: '0T3130115', rentalClass: 'E6' };
const PHOTO = 'data:image/jpeg;base64,TAG';

describe('failedScanCarryover', () => {
  it('⭐ a photographed scan that matched NOTHING carries its photo and its read', () => {
    expect(failedScanCarryover(PHOTO, SIDEWAYS, false)).toEqual({ photo: PHOTO, read: SIDEWAYS });
  });

  // ⚠️⚠️ THE GUARD THAT MATTERS. A scan that matched has already attached its photo; carrying it
  // onto a different typed plate would put one car's tag on another. The comment this replaced was
  // right about exactly this — "a stale one would lie".
  it('⚠️⚠️ a scan that MATCHED a car carries nothing', () => {
    expect(failedScanCarryover(PHOTO, SIDEWAYS, true)).toBeNull();
  });

  it('a typed lookup with no scan behind it carries nothing', () => {
    expect(failedScanCarryover(null, null, false)).toBeNull();
    expect(failedScanCarryover(null, SIDEWAYS, false)).toBeNull();   // read, but no photo to keep
    expect(failedScanCarryover(PHOTO, null, false)).toBeNull();      // photo, but nothing was read
  });
});

describe('readWithTypedKey', () => {
  it('nothing carried → the typed key IS the read, as before', () => {
    expect(readWithTypedKey(null, { plate: '261PDU' })).toEqual({ plate: '261PDU' });
  });

  // ⭐ His whole reason for scanning: the VIN is on the tag, and the record's is blank.
  it('⭐ carries the fields the read DID manage, under his typed plate', () => {
    const r = readWithTypedKey({ photo: PHOTO, read: SIDEWAYS }, { plate: '261PDU' });
    expect(r).toEqual({ plate: '261PDU', classCode: 'CCLM', vinLast9: '0T3130115', rentalClass: 'E6' });
  });

  // ⚠️ THE TYPED KEY WINS. He is looking at the tag; the read already proved it could not identify
  // the car. A plate the model hallucinated must never survive beside the one he typed.
  it('⚠️ the typed plate overrides whatever the read thought it saw', () => {
    const r = readWithTypedKey({ photo: PHOTO, read: { ...SIDEWAYS, plate: 'ZZZ999' } }, { plate: '261PDU' });
    expect(r.plate).toBe('261PDU');
  });

  // ⚠️ And the OPPOSITE key is dropped, not kept: a unit lookup must not drag along a plate the
  // read failed to match, or the lookup would carry two disagreeing identities.
  it('⚠️ typing a UNIT drops the read\'s plate entirely', () => {
    const r = readWithTypedKey({ photo: PHOTO, read: { ...SIDEWAYS, plate: 'ZZZ999' } }, { unitNumber: '2148476' });
    expect(r.unitNumber).toBe('2148476');
    expect(r.plate).toBeUndefined();
  });

  it('keeps the read intact otherwise — nothing invented, nothing lost', () => {
    const r = readWithTypedKey({ photo: PHOTO, read: SIDEWAYS }, { unitNumber: '2148476' });
    expect(r.vinLast9).toBe('0T3130115');
    expect(r.rentalClass).toBe('E6');
  });
});
