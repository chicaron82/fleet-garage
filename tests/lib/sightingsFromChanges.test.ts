import { describe, it, expect } from 'vitest';
import { sightingsFromChanges, SCRIPT_WRITTEN_FIELDS, type VehicleChange } from '../../src/lib/sightings';

// Aaron, looking at a Jetta that read "Never scanned" above four record changes from that same day:
// "shouldn't it be showing last seen today 13:53 scanned 2x or however many interactions were done."
// FG had watched him work on that car twice and reported it had never seen it.

const c = (changedAt: string, ...fields: string[]): VehicleChange => ({ changedAt, fields });

describe('sightingsFromChanges — the interactions already in the change log', () => {
  // ⚠️⚠️ THE TRAP THE WHOLE DESIGN EXISTS TO AVOID. Fleet-wide, the three biggest change
  // categories are BACKFILL SCRIPTS: class_code 659 rows / 613 cars, vin_last9 428, owning_area
  // 293. Derive naively and FG reports he toured six hundred cars on 2026-08-25.
  it('refuses every row a backfill script wrote', () => {
    expect(sightingsFromChanges([
      c('2026-08-20T04:23:50Z', 'class_code', 'field_sources'),
      c('2026-08-25T02:00:00Z', 'vin_last9'),
      c('2026-08-19T09:00:00Z', 'owning_area', 'field_sources'),
      c('2026-08-22T09:00:00Z', 'cover_photo_url'),
    ])).toEqual([]);
  });

  // ⭐ THE LIVE CASE — LUR224's own rows, exactly as the DB holds them.
  it('recovers the Jetta\'s day: keys, odometer, then the PM status', () => {
    const out = sightingsFromChanges([
      c('2026-08-28T18:53:45Z', 'status'),
      c('2026-08-28T16:17:27Z', 'odometer', 'odometer_at'),
      c('2026-08-28T16:17:21Z', 'key_count'),
      c('2026-08-20T04:23:50Z', 'class_code', 'field_sources'),  // ← my backfill, must not count
    ]);
    expect(out.map(s => s.seenAt)).toEqual([
      '2026-08-28T18:53:45Z', '2026-08-28T16:17:27Z', '2026-08-28T16:17:21Z',
    ]);
  });

  // One SAVE that touched two fields is one row and therefore one interaction — the odometer and
  // its timestamp always travel together and must never count twice.
  it('counts a multi-field save once', () => {
    expect(sightingsFromChanges([c('2026-08-28T16:17:27Z', 'odometer', 'odometer_at')])).toHaveLength(1);
  });

  // ⭐ A BLOCKLIST, NOT A WHITELIST. Aaron: "are you forgetting that FG is my personal tool. and its
  // ONLY user." There is no someone who might have done this from a desk — there is only him. So a
  // field nobody has scripted counts, including ones this rule has never seen before.
  it('counts a field the rule has never met, because only he writes them', () => {
    expect(sightingsFromChanges([c('2026-09-01T10:00:00Z', 'some_future_field')])).toHaveLength(1);
  });

  // A mixed row still counts: the script wrote class_code, but HE set the key count in the same
  // save, and he was standing there to do it.
  it('counts a row where a real edit rode alongside a scripted field', () => {
    expect(sightingsFromChanges([c('2026-08-28T12:00:00Z', 'class_code', 'key_count')])).toHaveLength(1);
  });

  it('carries WHEN but never WHO — vehicle_changes has no actor', () => {
    expect(sightingsFromChanges([c('2026-08-28T12:00:00Z', 'status')])[0].seenByName).toBeNull();
  });

  it('skips a row with no timestamp rather than inventing one', () => {
    expect(sightingsFromChanges([c('', 'status')])).toEqual([]);
  });

  it('names exactly the five fields scripts have written', () => {
    expect([...SCRIPT_WRITTEN_FIELDS].sort()).toEqual(
      ['class_code', 'cover_photo_url', 'field_sources', 'owning_area', 'vin_last9'],
    );
  });
});
