import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐ A RETAKE STARTS A NEW PHOTO, SO EVERYTHING THAT DESCRIBED THE OLD ONE RESETS.
//
// The audit stamp, the audit result (incl. 'stale' — the "Older plate" chip), the "this tag is this
// car's" confirmation, and — added 2026-09-24 — the ROTATION. Each is a property of one specific
// photo. The rotation was missed until a re-plate began retaking automatically with the scan's own
// photo (docs/September/ticket-replate-uses-the-scan-photo.md): a sideways old tag stored at 90°
// would have turned its upright replacement 90° too.

let patch: Record<string, unknown> = {};

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (p: Record<string, unknown>) => {
        patch = p;
        const chain = { eq: () => chain, select: () => Promise.resolve({ data: [{ id: 'v-1' }], error: null }) };
        return chain;
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  uploadPhoto: vi.fn(async () => 'https://cdn/new-tag.jpg'),
}));

import { makeRetakeKeytagPhoto } from '../../src/context/keytagPhotoWrite';
import { uploadPhoto } from '../../src/lib/garage-uploads';
import type { Vehicle } from '../../src/types';

beforeEach(() => { patch = {}; });

describe('retakeKeytagPhoto', () => {
  it('replaces the photo and resets every stamp that described the old one', async () => {
    const setAllVehicles = vi.fn();
    const retake = makeRetakeKeytagPhoto({ setAllVehicles });
    expect(await retake('v-1', 'data:image/jpeg;base64,NEW')).toBe(true);
    expect(patch).toEqual({
      keytag_photo_url: 'https://cdn/new-tag.jpg',
      keytag_audited_at: null,
      keytag_audited_by: null,
      keytag_audit_result: null,              // ⭐ clears 'stale' — the "Older plate" chip goes
      keytag_photo_confirmed_at: null,
      keytag_photo_confirmed_by: null,
      keytag_photo_rotation: 0,               // ⭐ the angle belonged to the OLD photo
    });
  });

  it('local state matches what was written — rotation included', async () => {
    const setAllVehicles = vi.fn();
    await makeRetakeKeytagPhoto({ setAllVehicles })('v-1', 'data:NEW');
    const updater = setAllVehicles.mock.calls[0][0] as (vs: Vehicle[]) => Vehicle[];
    const [after] = updater([{ id: 'v-1', keytagPhotoRotation: 90, keytagAuditResult: 'stale' } as Vehicle]);
    expect(after.keytagPhotoRotation).toBe(0);
    expect(after.keytagAuditResult).toBeNull();
    expect(after.keytagPhotoUrl).toBe('https://cdn/new-tag.jpg');
  });

  it('writes nothing and reports false when the upload fails', async () => {
    vi.mocked(uploadPhoto).mockResolvedValueOnce(null);
    const setAllVehicles = vi.fn();
    expect(await makeRetakeKeytagPhoto({ setAllVehicles })('v-1', 'data:NEW')).toBe(false);
    expect(patch).toEqual({});
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
});
