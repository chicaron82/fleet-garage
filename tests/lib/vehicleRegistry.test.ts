import { describe, it, expect } from 'vitest';
import {
  mapEntry, computeEnrichUpdates, classifyLookup, mergeEntries,
} from '../../src/lib/vehicleRegistry';
import type { VehicleRegistryEntry } from '../../src/types';

const entry = (over: Partial<VehicleRegistryEntry> = {}): VehicleRegistryEntry => ({
  id: 'e1', branchId: 'YWG', vehicleId: null, plate: null, unitNumber: null,
  make: null, model: null, year: null, color: null,
  arrivedAt: null, cleanedAt: null, dispatchedAt: null,
  needsReview: false, createdAt: '2026-05-01T00:00:00Z', date: '2026-05-01',
  ...over,
});

// ── mapEntry ──────────────────────────────────────────────────────────────────

describe('mapEntry', () => {
  it('maps a snake_case row to a camelCase entry', () => {
    const row = {
      id: 'r1', branch_id: 'YWG', vehicle_id: 'v1', plate: 'ABC123', unit_number: 'U1',
      make: 'Toyota', model: 'Corolla', year: 2024, color: 'White',
      arrived_at: '2026-05-01T08:00:00Z', cleaned_at: null, dispatched_at: null,
      needs_review: true, created_at: '2026-05-01T07:00:00Z', date: '2026-05-01',
    };
    expect(mapEntry(row)).toEqual({
      id: 'r1', branchId: 'YWG', vehicleId: 'v1', plate: 'ABC123', unitNumber: 'U1',
      make: 'Toyota', model: 'Corolla', year: 2024, color: 'White',
      arrivedAt: '2026-05-01T08:00:00Z', cleanedAt: null, dispatchedAt: null,
      needsReview: true, createdAt: '2026-05-01T07:00:00Z', date: '2026-05-01',
    });
  });

  it('defaults nullable fields to null and needs_review to false', () => {
    const e = mapEntry({ id: 'r2', branch_id: 'YWG', created_at: 'x', date: '2026-05-02' });
    expect(e.plate).toBeNull();
    expect(e.unitNumber).toBeNull();
    expect(e.vehicleId).toBeNull();
    expect(e.needsReview).toBe(false);
  });
});

// ── computeEnrichUpdates ──────────────────────────────────────────────────────

describe('computeEnrichUpdates', () => {
  it('fills only the fields the existing record is missing (never overwrites)', () => {
    const existing = entry({ plate: 'ABC123' });
    expect(computeEnrichUpdates(existing, { plate: 'XYZ999', unitNumber: 'U7', make: 'Kia' }))
      .toEqual({ unit_number: 'U7', make: 'Kia' });
  });

  it('returns empty when nothing is missing', () => {
    const existing = entry({ plate: 'ABC', unitNumber: 'U1', make: 'Toyota' });
    expect(computeEnrichUpdates(existing, { plate: 'ABC', unitNumber: 'U1' })).toEqual({});
  });

  it('sets needs_review only when truthy', () => {
    expect(computeEnrichUpdates(entry(), { needsReview: true })).toEqual({ needs_review: true });
    expect(computeEnrichUpdates(entry(), { needsReview: false })).toEqual({});
  });

  it('fills a provided value into a null field', () => {
    expect(computeEnrichUpdates(entry(), { year: 2024, color: 'Red' }))
      .toEqual({ year: 2024, color: 'Red' });
  });
});

// ── classifyLookup ────────────────────────────────────────────────────────────

describe('classifyLookup', () => {
  it('clean match → found', () => {
    expect(classifyLookup(entry({ plate: 'ABC', unitNumber: 'U1' }), 'ABC', 'U1', false)).toBe('found');
  });

  it('caller supplies an identifier the record lacks → merge_candidate', () => {
    expect(classifyLookup(entry({ unitNumber: 'U1' }), 'ABC', 'U1', false)).toBe('merge_candidate');
  });

  it('conflicting identifier → merge_candidate', () => {
    expect(classifyLookup(entry({ plate: 'ABC' }), 'XYZ', null, false)).toBe('merge_candidate');
  });

  it('a confirmed pairing suppresses merge_candidate', () => {
    expect(classifyLookup(entry({ plate: 'ABC' }), 'XYZ', null, true)).toBe('found');
  });

  it('no extra identifier provided → found', () => {
    expect(classifyLookup(entry({ plate: 'ABC' }), 'ABC', null, false)).toBe('found');
  });
});

// ── mergeEntries ──────────────────────────────────────────────────────────────

describe('mergeEntries', () => {
  it('keep-wins for identity fields; merge fills keep gaps', () => {
    const keep  = entry({ plate: 'KEEP', make: 'Toyota' });
    const merge = entry({ plate: 'MERGE', make: 'Kia', model: 'Rio' });
    const u = mergeEntries(keep, merge);
    expect(u.plate).toBe('KEEP');
    expect(u.make).toBe('Toyota');
    expect(u.model).toBe('Rio');
  });

  it('earliest-wins for timestamps', () => {
    const keep  = entry({ arrivedAt: '2026-05-02T10:00:00Z', cleanedAt: null });
    const merge = entry({ arrivedAt: '2026-05-02T08:00:00Z', cleanedAt: '2026-05-02T12:00:00Z' });
    const u = mergeEntries(keep, merge);
    expect(u.arrived_at).toBe('2026-05-02T08:00:00Z');
    expect(u.cleaned_at).toBe('2026-05-02T12:00:00Z');
  });

  it('null timestamps on both sides → null', () => {
    expect(mergeEntries(entry(), entry()).dispatched_at).toBeNull();
  });

  it('always resets needs_review to false', () => {
    expect(mergeEntries(entry({ needsReview: true }), entry({ needsReview: true })).needs_review).toBe(false);
  });
});
