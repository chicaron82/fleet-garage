import { describe, it, expect } from 'vitest';
import { createUserResolver } from '../../src/lib/user-resolver';
import type { Profile } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ana: Profile = {
  id: 'uuid-ana',
  employeeId: 'EMP1001',
  name: 'Ana Reyes',
  role: 'VSA',
  branchId: 'YWG',
};

const ben: Profile = {
  id: 'uuid-ben',
  employeeId: 'EMP1002',
  name: 'Ben Cruz',
  role: 'Branch Manager',
  branchId: 'YWG',
};

const profiles = new Map<string, Profile>([
  [ana.id, ana],
  [ben.id, ben],
]);

const resolver = createUserResolver(profiles);
const empty = createUserResolver(new Map());

// ── getName ─────────────────────────────────────────────────────────────────

describe('createUserResolver — getName', () => {
  it('returns the profile name when the id is present', () => {
    expect(resolver.getName('uuid-ana')).toBe('Ana Reyes');
  });

  it('falls back to the snapshot when the id is absent', () => {
    expect(resolver.getName('uuid-ghost', 'Snapshot Name')).toBe('Snapshot Name');
  });

  it("returns 'Unknown' when the id is absent and no snapshot is given", () => {
    expect(resolver.getName('uuid-ghost')).toBe('Unknown');
  });

  it("treats an empty-string snapshot as no snapshot ('Unknown')", () => {
    expect(resolver.getName('uuid-ghost', '')).toBe('Unknown');
  });

  it('prefers the live profile over a provided snapshot', () => {
    // A stale denorm snapshot must never shadow a current profile name.
    expect(resolver.getName('uuid-ana', 'Stale Name')).toBe('Ana Reyes');
  });
});

// ── getRole ───────────────────────────────────────────────────────────────────

describe('createUserResolver — getRole', () => {
  it('returns the profile role when present', () => {
    expect(resolver.getRole('uuid-ben')).toBe('Branch Manager');
  });

  it("returns '' when the id is absent (no snapshot tier for role)", () => {
    expect(resolver.getRole('uuid-ghost')).toBe('');
  });
});

// ── getEmpId ──────────────────────────────────────────────────────────────────

describe('createUserResolver — getEmpId', () => {
  it('returns the profile employee id when present', () => {
    expect(resolver.getEmpId('uuid-ana')).toBe('EMP1001');
  });

  it('falls back to the snapshot when the id is absent', () => {
    expect(resolver.getEmpId('uuid-ghost', 'EMP9999')).toBe('EMP9999');
  });

  it("returns '' when the id is absent and no snapshot is given", () => {
    expect(resolver.getEmpId('uuid-ghost')).toBe('');
  });

  it("treats an empty-string snapshot as no snapshot ('')", () => {
    expect(resolver.getEmpId('uuid-ghost', '')).toBe('');
  });
});

// ── getProfile ────────────────────────────────────────────────────────────────

describe('createUserResolver — getProfile', () => {
  it('returns the full profile object by id', () => {
    expect(resolver.getProfile('uuid-ben')).toBe(ben);
  });

  it('returns null when the id is absent', () => {
    expect(resolver.getProfile('uuid-ghost')).toBeNull();
  });
});

// ── getByEmployeeId ─────────────────────────────────────────────────────────

describe('createUserResolver — getByEmployeeId', () => {
  it('returns the matching profile by employee id', () => {
    expect(resolver.getByEmployeeId('EMP1002')).toBe(ben);
  });

  it('returns null when no profile has that employee id', () => {
    expect(resolver.getByEmployeeId('EMP0000')).toBeNull();
  });
});

// ── empty map ─────────────────────────────────────────────────────────────────

describe('createUserResolver — empty profiles map', () => {
  it("getName with no snapshot is 'Unknown'", () => {
    expect(empty.getName('anything')).toBe('Unknown');
  });

  it('getName still honours a snapshot', () => {
    expect(empty.getName('anything', 'Denorm Name')).toBe('Denorm Name');
  });

  it('getProfile / getByEmployeeId are null', () => {
    expect(empty.getProfile('anything')).toBeNull();
    expect(empty.getByEmployeeId('EMP1001')).toBeNull();
  });
});
