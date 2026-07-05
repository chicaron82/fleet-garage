import { describe, it, expect } from 'vitest';
import { photoCaptionFor, photoButtonLabel, PHOTO_CONTEXTS } from '../../../api/_lib/photoRequest';

describe('photoRequest', () => {
  it('captions each context so it reads (and routes) correctly — never "damage" on a keytag', () => {
    expect(photoCaptionFor('keytag')).toBe("Here's a photo of the key tag.");
    expect(photoCaptionFor('damage')).toBe("Here's a photo of the damage.");
    expect(photoCaptionFor('lost_item')).toBe("Here's a photo of the lost item.");
    expect(photoCaptionFor('inventory')).toBe("Here's a photo of the inventory sheet.");
  });

  it('labels the inline upload button per context', () => {
    expect(photoButtonLabel('keytag')).toBe('Upload key tag');
    expect(photoButtonLabel('inventory')).toBe('Upload sheet');
  });

  it('every context has a caption and a label (exhaustive)', () => {
    for (const c of PHOTO_CONTEXTS) {
      expect(photoCaptionFor(c)).toMatch(/^Here's a photo of the /);
      expect(photoButtonLabel(c).length).toBeGreaterThan(0);
    }
  });
});
