import { describe, it, expect } from 'vitest';
import { buildOverflowTrip } from '../../src/lib/overflowTrip';

const NOW = 1_782_000_000_000; // fixed ms for deterministic ids/timestamps

describe('buildOverflowTrip', () => {
  it('builds a completed one-way trip with the granular destination as arrive_location', () => {
    const t = buildOverflowTrip({ plate: 'LFJ379', unit: '1234' }, 'AV Flight', 'driver-1', 'YWG', NOW, 0);
    expect(t.arrive_location).toBe('AV Flight');
    expect(t.one_way).toBe(true);
    expect(t.status).toBe('complete');
    expect(t.trip_type).toBe('clean');
    expect(t.depart_location).toBe('Airport Run'); // consistent with existing run rows
    expect(t.is_shuttle).toBe(false);
  });

  it('maps vehicle identity and driver/branch through', () => {
    const t = buildOverflowTrip({ plate: 'LUR175', unit: null }, 'FastAir', 'driver-9', 'YWG', NOW, 0);
    expect(t.vehicle_plate).toBe('LUR175');
    expect(t.vehicle_unit).toBeNull();
    expect(t.driver_id).toBe('driver-9');
    expect(t.branch_id).toBe('YWG');
  });

  it('derives one deterministic timestamp for depart and arrive from nowMs', () => {
    const t = buildOverflowTrip({ plate: 'KUR250', unit: '250' }, 'Airport', 'd', null, NOW, 0);
    const iso = new Date(NOW).toISOString();
    expect(t.depart_time).toBe(iso);
    expect(t.arrive_time).toBe(iso);
    expect(t.branch_id).toBeNull();
  });

  it('gives each row in a batch a collision-free id keyed by index', () => {
    const a = buildOverflowTrip({ plate: 'A', unit: null }, 'AV Flight', 'd', 'YWG', NOW, 0);
    const b = buildOverflowTrip({ plate: 'B', unit: null }, 'AV Flight', 'd', 'YWG', NOW, 1);
    expect(a.id).toBe(`trip-${NOW}-0`);
    expect(b.id).toBe(`trip-${NOW}-1`);
    expect(a.id).not.toBe(b.id);
  });
});
