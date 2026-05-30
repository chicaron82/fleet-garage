import { describe, it, expect } from 'vitest';
import { isTeslaMake, classifyTesla, type TeslaVehicleRow, type EvStatusRow } from '../../src/lib/ev-detection';

const tesla: TeslaVehicleRow  = { make: 'Tesla',  model: 'Model 3', year: 2025, color: 'Red' };
const toyota: TeslaVehicleRow = { make: 'Toyota', model: 'Corolla', year: 2024, color: 'White' };

// ── isTeslaMake ───────────────────────────────────────────────────────────────

describe('isTeslaMake', () => {
  it('is case-insensitive', () => {
    expect(isTeslaMake('Tesla')).toBe(true);
    expect(isTeslaMake('TESLA')).toBe(true);
    expect(isTeslaMake('tesla')).toBe(true);
  });

  it('is false for other makes and nullish input', () => {
    expect(isTeslaMake('Toyota')).toBe(false);
    expect(isTeslaMake('')).toBe(false);
    expect(isTeslaMake(null)).toBe(false);
    expect(isTeslaMake(undefined)).toBe(false);
  });
});

// ── classifyTesla ─────────────────────────────────────────────────────────────

describe('classifyTesla', () => {
  it('no vehicle → not a Tesla, no vehicle info', () => {
    expect(classifyTesla(null, null)).toEqual({ isTesla: false, lastCable: null, lastAdapter: null });
  });

  it('non-Tesla vehicle → not Tesla but includes vehicle info', () => {
    const r = classifyTesla(toyota, null);
    expect(r.isTesla).toBe(false);
    expect(r.lastCable).toBeNull();
    expect(r.lastAdapter).toBeNull();
    expect(r.vehicle).toEqual({ make: 'Toyota', model: 'Corolla', year: 2024, color: 'White' });
  });

  it('Tesla with no prior EV-status trip → Tesla with null statuses', () => {
    const r = classifyTesla(tesla, null);
    expect(r.isTesla).toBe(true);
    expect(r.lastCable).toBeNull();
    expect(r.lastAdapter).toBeNull();
    expect(r.vehicle).toEqual({ make: 'Tesla', model: 'Model 3', year: 2025, color: 'Red' });
  });

  it('Tesla with a prior trip → carries the recorded cable/adapter statuses', () => {
    const lastTrip: EvStatusRow = { ev_cable_status: 'present', ev_adapter_status: 'missing' };
    const r = classifyTesla(tesla, lastTrip);
    expect(r.isTesla).toBe(true);
    expect(r.lastCable).toBe('present');
    expect(r.lastAdapter).toBe('missing');
  });

  it('ignores the trip row entirely for a non-Tesla', () => {
    const lastTrip: EvStatusRow = { ev_cable_status: 'present', ev_adapter_status: 'present' };
    const r = classifyTesla(toyota, lastTrip);
    expect(r.lastCable).toBeNull();
    expect(r.lastAdapter).toBeNull();
  });

  it('coerces null trip statuses to null', () => {
    const r = classifyTesla(tesla, { ev_cable_status: null, ev_adapter_status: null });
    expect(r.lastCable).toBeNull();
    expect(r.lastAdapter).toBeNull();
  });
});
