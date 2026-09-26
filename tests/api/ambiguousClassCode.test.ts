import { describe, it, expect, vi } from 'vitest';
import { lookupVehicleClass, isAmbiguousClassCode, isTeachableClassCode } from '../../api/_lib/vehicleClassCodex';
import { toKeytagRead } from '../../api/_lib/keytagReader';
import { isUnknownClassCode } from '../../src/lib/partialRegister';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
  writeWithRefresh: vi.fn(),
}));
import { pinClassMapping } from '../../src/context/classPinWrite';
import { supabase } from '../../src/lib/supabase';

// Aaron, 2026-09-25: 16 of 17 CTAV cars were Trax, the codex said Trailblazer, and "our fleet manager
// flip flips between them". Registering one Trailblazer pinned CTAV → B5 over every Trax.
describe('CTAV names two cars, so FG never guesses it', () => {
  it('⭐ resolves to no make or model', () => {
    expect(isAmbiguousClassCode('CTAV')).toBe(true);
    expect(isAmbiguousClassCode('ctav ')).toBe(true);
    expect(lookupVehicleClass('CTAV')).toBeNull();
    const read = toKeytagRead({ classCode: 'CTAV', year: 26, rentalClass: 'B4' });
    expect(read.make).toBeUndefined();
    expect(read.model).toBeUndefined();
    expect(read.rentalClass).toBe('B4'); // the tag's own printed class still reads
  });

  it('⭐ is never taught, and never logged as unknown', () => {
    expect(isTeachableClassCode('CTAV')).toBe(false);
    expect(isUnknownClassCode({ classCode: 'CTAV' })).toBe(false);
    // …while a genuinely unknown code still is.
    expect(isTeachableClassCode('CQZZ')).toBe(true);
    expect(isUnknownClassCode({ classCode: 'CQZZ' })).toBe(true);
  });

  it('⭐ refuses a class pin, without touching the table', async () => {
    const outcome = await pinClassMapping('CTAV', 'B5');
    expect(outcome.pinned).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('leaves the other Chevy codes alone', () => {
    expect(lookupVehicleClass('CTXF')).toEqual({ make: 'Chevrolet', model: 'Trax' });
    expect(lookupVehicleClass('CTBA')).toEqual({ make: 'Chevrolet', model: 'Trailblazer' });
    // Corrected 2026-09-25: CTAA was mapped to Trax; all 4 CTAA cars are B5 Trailblazers.
    expect(lookupVehicleClass('CTAA')).toEqual({ make: 'Chevrolet', model: 'Trailblazer' });
  });
});

// Pass two: Effie's code lookup is the other door. She must hear "two cars — ask", not "unknown".
import { executeLookupVehicleClass } from '../../api/_lib/effie/vehicleExecutors';
describe("Effie's code lookup", () => {
  it('⭐ tells her CTAV is more than one model', () => {
    const r = JSON.parse(executeLookupVehicleClass({ code: 'CTAV' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/more than one model/);
  });
});
