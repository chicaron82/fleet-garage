import { describe, it, expect } from 'vitest';
import { normalizeOwning, owningLabel, isForeignOwning, HOME_OWNING } from '../../api/_lib/owningArea';

describe('normalizeOwning', () => {
  it('strips the leading zero the printed tag uses ("08199")', () => {
    expect(normalizeOwning('08199')).toBe('8199');
    expect(normalizeOwning('8199')).toBe('8199');
  });
  it('rejects anything too short to be an owning — a stray digit is not a branch', () => {
    expect(normalizeOwning('81')).toBe('');
    expect(normalizeOwning('')).toBe('');
    expect(normalizeOwning(null)).toBe('');
  });
});

describe('owningLabel', () => {
  it('names the branches Aaron gave', () => {
    expect(owningLabel('08199')).toBe('Winnipeg (8199)');
    expect(owningLabel('8193')).toBe('Calgary (8193)');
    expect(owningLabel('8191')).toBe('Vancouver (8191)');
    expect(owningLabel('8197')).toBe('Toronto (8197)');
  });

  it('⭐ shows an UNKNOWN owning as the bare number rather than guessing a branch', () => {
    // New branches appear and codes rotate; inventing a name would be worse than showing digits.
    expect(owningLabel('8123')).toBe('8123');
  });

  it('⭐ still names 8999 — Winnipeg\'s owning BEFORE the renumber', () => {
    // Aaron started under 8999/589xxxx/592xxxx. Historical cars must not read as a foreign branch.
    // Named plainly — the number distinguishes it from 8199 without a stuttering label.
    expect(owningLabel('8999')).toBe('Winnipeg (8999)');
  });
});

describe('isForeignOwning', () => {
  it('is quiet for the home branch — 8199 on every scan would be noise', () => {
    expect(isForeignOwning('8199')).toBe(false);
    expect(isForeignOwning(HOME_OWNING)).toBe(false);
  });

  it('⭐ flags another branch — the input to the keep-and-reflip decision', () => {
    // Aaron's example: unit 5780176 / plate 0HC124, a Calgary car sitting in the Winnipeg bay.
    expect(isForeignOwning('8193')).toBe(true);
    expect(isForeignOwning('8191')).toBe(true);
  });

  it('⭐ does NOT treat 8999 as foreign — it is Winnipeg under the old numbering', () => {
    expect(isForeignOwning('8999')).toBe(false);
  });

  it('⭐ absent owning is NOT foreign — most of the fleet predates this capture', () => {
    // Every car registered before today reads empty. Flagging those would make the signal useless
    // exactly when the field is newest — same rule as never-seen not being stale.
    expect(isForeignOwning('')).toBe(false);
    expect(isForeignOwning(null)).toBe(false);
    expect(isForeignOwning(undefined)).toBe(false);
  });
});
