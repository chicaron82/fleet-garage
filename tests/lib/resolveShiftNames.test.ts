import { describe, it, expect } from 'vitest';
import { resolveShiftNames } from '../../src/lib/resolveShiftNames';
import type { ShiftWithUser, Profile } from '../../src/types';

const mk = (userId: string, name: string, role: string = 'VSA'): ShiftWithUser =>
  ({ id: 'sh_' + userId, userId, branchId: 'YWG', user: { name, role } } as unknown as ShiftWithUser);

const P = (id: string, name: string, branchId: string = 'YWG'): Profile =>
  ({ id, name, role: 'VSA', branchId } as unknown as Profile);

describe('resolveShiftNames (the load-order-race fix)', () => {
  const profiles = new Map<string, Profile>([['u1', P('u1', 'Ray T.')]]);
  const getProfile = (id: string) => profiles.get(id) ?? null;

  it('re-resolves an Unknown shift to the real profile name', () => {
    const [out] = resolveShiftNames([mk('u1', 'Unknown')], getProfile);
    expect(out.user.name).toBe('Ray T.');
  });

  it('keeps the same object reference when already resolved (no needless re-render)', () => {
    const already = mk('u1', 'Ray T.');
    const [out] = resolveShiftNames([already], getProfile);
    expect(out).toBe(already);
  });

  it('passes through unchanged when no profile exists (stays Unknown, no crash)', () => {
    const orphan = mk('ghost', 'Unknown');
    const [out] = resolveShiftNames([orphan], getProfile);
    expect(out).toBe(orphan);
    expect(out.user.name).toBe('Unknown');
  });

  it('adopts the profile branch when it resolves a name', () => {
    const p = new Map<string, Profile>([['u2', P('u2', 'Eugene', 'YYC')]]);
    const [out] = resolveShiftNames([mk('u2', 'Unknown')], id => p.get(id) ?? null);
    expect(out.user.name).toBe('Eugene');
    expect(out.branchId).toBe('YYC');
  });
});
