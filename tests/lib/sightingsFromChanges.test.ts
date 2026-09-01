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

  // ⚠️ THIS TEST USED TO ASSERT THE OPPOSITE — "carries WHEN but never WHO — vehicle_changes has
  // no actor" — which was true when it was written and quietly false from migration 132 onward.
  // It is the reason the defect survived: a stale comment repeated as a green assertion stops
  // looking like an oversight and starts looking like a decision. Aaron caught it by reading the
  // interactions list against the change log beneath it (2026-09-01).
  it('carries the ACTOR through, so a derived interaction can be attributed', () => {
    const row = sightingsFromChanges([
      { changedAt: '2026-08-28T12:00:00Z', fields: ['status'], actor: '9f560505' },
    ])[0];
    expect(row.actor).toBe('9f560505');
    // Still never a NAME: the id is raw here on purpose, resolved where the profiles live.
    expect(row.seenByName).toBeNull();
  });

  it('normalises a missing actor to null rather than leaving it undefined', () => {
    // Every row before migration 132 genuinely has none; `null` says "asked and there is nobody",
    // `undefined` says "never asked", and the renderer should not have to tell them apart.
    expect(sightingsFromChanges([c('2026-08-28T12:00:00Z', 'status')])[0].actor).toBeNull();
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
