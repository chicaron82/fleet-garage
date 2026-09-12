/**
 * OVERFLOW SENDS FROM KEY-TAG PHOTOS — the chat path stops throwing the tag away.
 *
 * ⭐ Aaron, 2026-09-08, after logging three cars through Effie and finding LJF710 still hollow:
 * *"anything that reads keytags shouldn't be tossing out valuable info"*. The tool took
 * `plates: string[]`, so the model read a tag carrying unit, owning area, rental class, model
 * code, VIN and colour, and could hand over one string.
 *
 * ⚠️ The shortcut was to widen the schema and let the chat model transcribe. He said
 * *"b properly. season it right take your time with the cook."* — so the executor calls the SAME
 * measured reader the scanner uses, and the deciding still happens client-side where the live
 * fleet is.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KeytagRead } from '../../../../api/_lib/keytagRead';

const readKeytagPhoto = vi.fn<(...a: unknown[]) => Promise<KeytagRead | null>>();
vi.mock('../../../../api/_lib/keytagReader.js', () => ({ readKeytagPhoto }));

const { executeProposeOverflowLog } = await import('../../../../api/_lib/effie/overflowExecutors');

const FLEET = [
  { id: 'v-1', license_plate: 'LUR537', unit_number: '5427968', make: 'Chevrolet', model: 'Trax', year: 2026, color: 'Black' },
  { id: 'v-2', license_plate: 'LJF710', unit_number: null, make: '', model: '', year: 0, color: '' },
];
const supabase = {
  from: () => ({
    select: () => ({ is: () => Promise.resolve({ data: FLEET, error: null }) }),
  }),
} as never;

const PHOTOS = (n: number) => ({
  images: Array.from({ length: n }, (_, i) => ({ mediaType: 'image/jpeg', data: `img-${i}` })),
  apiKey: 'k', userId: 'u-1',
});

beforeEach(() => { vi.clearAllMocks(); });

describe('the photos are READ, not transcribed', () => {
  it('⭐⭐ every attached photo goes through the shared reader', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537', unitNumber: '5427968' });
    await executeProposeOverflowLog(supabase, { destination: 'FastAir' }, PHOTOS(3));
    expect(readKeytagPhoto).toHaveBeenCalledTimes(3);
  });

  it('⭐⭐⭐ the READ rides on the proposal, so the client can decide what it means', async () => {
    const read: KeytagRead = {
      plate: 'LJF710', unitNumber: '5427800', make: 'Kia', model: 'Seltos',
      year: 2026, color: 'Silver', owningArea: '8199', rentalClass: 'Q4',
    };
    readKeytagPhoto.mockResolvedValue(read);
    const out = await executeProposeOverflowLog(supabase, { destination: 'AV Flight' }, PHOTOS(1));
    const v = out.proposal!.vehicles[0]!;
    expect(v.read).toEqual(read);          // the WHOLE tag, not just the plate
    expect(v.photoIndex).toBe(0);
  });

  it('⚠️ the tag supplies the unit when the record has none — LJF710 logged a null unit', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LJF710', unitNumber: '5427800' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'AV Flight' }, PHOTOS(1));
    expect(out.proposal!.vehicles[0]!.unit).toBe('5427800');
  });

  it('the RECORD still wins where it has a unit', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537', unitNumber: '9999999' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'AV Flight' }, PHOTOS(1));
    expect(out.proposal!.vehicles[0]!.unit).toBe('5427968');
  });
});

describe('a stack is not all-or-nothing', () => {
  it('⚠️ one unreadable tag must not cost him the other two', async () => {
    readKeytagPhoto
      .mockResolvedValueOnce({ plate: 'LUR537' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ plate: 'LJF710' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'FastAir' }, PHOTOS(3));
    expect(out.proposal!.vehicles).toHaveLength(2);
    expect(JSON.parse(out.toolResult).unreadablePhotos).toBe(1);
  });

  it('⚠️ a reader that THROWS is the same case as one that returns nothing', async () => {
    readKeytagPhoto
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValueOnce({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'FastAir' }, PHOTOS(2));
    expect(out.proposal!.vehicles).toHaveLength(1);
  });

  it('the same tag photographed twice is one send', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'FastAir' }, PHOTOS(2));
    expect(out.proposal!.vehicles).toHaveLength(1);
  });
});

describe('typed plates still work, and mix', () => {
  it('⭐ photos with no plates at all is a complete instruction', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'AV Flight' }, PHOTOS(1));
    expect(out.proposal).not.toBeNull();
  });

  // ⭐⭐ Aaron, 2026-09-11: *"anything sent to Richardson doesn't count… it's sitting in an O or P
  // stall available for rent."* A car at the airport is in circulation and the airport tracks it;
  // drafting it as an overflow send would put a rentable car on the "parked elsewhere" manifest.
  it('REFUSES the airport — a Richardson run is a trip, not an overflow send', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'Airport' }, PHOTOS(1));
    expect(out.proposal).toBeNull();
    expect(JSON.parse(out.toolResult).ok).toBe(false);
  });

  it('a typed plate the photos did not cover is still added', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(
      supabase, { destination: 'FastAir', plates: ['LJF710'] }, PHOTOS(1));
    expect(out.proposal!.vehicles.map(v => v.plate).sort()).toEqual(['LJF710', 'LUR537']);
  });

  it('a typed plate a photo ALSO covered is not sent twice', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(
      supabase, { destination: 'FastAir', plates: ['LUR537'] }, PHOTOS(1));
    expect(out.proposal!.vehicles).toHaveLength(1);
    expect(out.proposal!.vehicles[0]!.read).toBeDefined();   // the READ version survived, not the string
  });

  it('no photos and no plates is still a refusal', async () => {
    const out = await executeProposeOverflowLog(supabase, { destination: 'FastAir' });
    expect(out.proposal).toBeNull();
    expect(JSON.parse(out.toolResult).ok).toBe(false);
  });

  it('an unknown destination is still a refusal, photos or not', async () => {
    readKeytagPhoto.mockResolvedValue({ plate: 'LUR537' });
    const out = await executeProposeOverflowLog(supabase, { destination: 'Timbuktu' }, PHOTOS(1));
    expect(out.proposal).toBeNull();
  });
});
