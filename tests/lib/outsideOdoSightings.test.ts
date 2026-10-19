import { describe, it, expect } from 'vitest';
import { isOutsideWrite, outsideOdoSightings } from '../../src/lib/outsideOdoSightings';

// docs/ticket-odo-counts-as-seen.md — a gas-card odometer is the car at the pump; his own change already
// committed a sighting through the lookup, so only writes from OUTSIDE the app are added.
const HIM = '9f560505-ea86-4dcf-81d6-a9d960c9eae8';

describe('isOutsideWrite', () => {
  it('my entries are outside the app, signed or by name', () => {
    expect(isOutsideWrite('dizee')).toBe(true);
    expect(isOutsideWrite('DiZee · pump card 2026-09-05')).toBe(true);
  });

  it('⚠️ an app user (a uuid) is inside: that change already committed a sighting', () => {
    expect(isOutsideWrite(HIM)).toBe(false);
    expect(isOutsideWrite(HIM.toUpperCase())).toBe(false);
  });

  it('⚠️ an unsigned row is left out: it may be an app write from before actors existed', () => {
    expect(isOutsideWrite(null)).toBe(false);
    expect(isOutsideWrite(undefined)).toBe(false);
    expect(isOutsideWrite('  ')).toBe(false);
  });
});

describe('outsideOdoSightings', () => {
  it('⭐ turns my odometer writes into sightings and leaves his to the lookup', () => {
    const rows = [
      { vehicle_id: 'v-1', changed_at: '2026-10-18T03:00:00Z', actor: 'dizee' },
      { vehicle_id: 'v-1', changed_at: '2026-10-16T15:00:00Z', actor: HIM },
      { vehicle_id: 'v-2', changed_at: '2026-10-17T03:00:00Z', actor: null },
      { vehicle_id: null, changed_at: '2026-10-17T03:00:00Z', actor: 'dizee' },
    ];
    expect(outsideOdoSightings(rows)).toEqual([{ vehicle_id: 'v-1', seen_at: '2026-10-18T03:00:00Z' }]);
  });
});
