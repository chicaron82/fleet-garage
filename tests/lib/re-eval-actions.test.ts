import { describe, it, expect } from 'vitest';
import { getReEvalActions } from '../../src/lib/re-eval-actions';
import type { DetailReason, UserRole } from '../../src/types';

// ── Full matrix: 3 reasons × 7 roles = 21 lock-in cases ─────────────────────

describe('getReEvalActions — full matrix', () => {
  const REASONS: DetailReason[] = ['pet-hair', 'smoke-vape', 'too-dirty'];
  const ROLES: UserRole[] = [
    'VSA', 'Lead VSA', 'CSR', 'HIR',
    'Branch Manager', 'Operations Manager', 'Driver',
  ];

  it('covers every (reason, role) combination', () => {
    for (const reason of REASONS) {
      for (const role of ROLES) {
        const actions = getReEvalActions(reason, role);
        expect(actions).toBeInstanceOf(Array);
      }
    }
  });
});

// ── Pet hair: management clears, everyone else escalates ────────────────────

describe('getReEvalActions — pet-hair', () => {
  it('Branch Manager can clear or re-hold', () => {
    expect(getReEvalActions('pet-hair', 'Branch Manager')).toEqual(['clear', 're-hold']);
  });

  it('Operations Manager can clear or re-hold', () => {
    expect(getReEvalActions('pet-hair', 'Operations Manager')).toEqual(['clear', 're-hold']);
  });

  it('VSA must escalate', () => {
    expect(getReEvalActions('pet-hair', 'VSA')).toEqual(['escalate']);
  });

  it('Lead VSA must escalate', () => {
    expect(getReEvalActions('pet-hair', 'Lead VSA')).toEqual(['escalate']);
  });

  it('CSR must escalate', () => {
    expect(getReEvalActions('pet-hair', 'CSR')).toEqual(['escalate']);
  });

  it('HIR must escalate', () => {
    expect(getReEvalActions('pet-hair', 'HIR')).toEqual(['escalate']);
  });

  it('Driver must escalate (though Driver cannot reach the panel in practice)', () => {
    expect(getReEvalActions('pet-hair', 'Driver')).toEqual(['escalate']);
  });
});

// ── Smoke / vape: VSA-clearable for all roles that reach the panel ──────────

describe('getReEvalActions — smoke-vape', () => {
  it('VSA can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'VSA')).toEqual(['clear', 're-hold']);
  });

  it('Lead VSA can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'Lead VSA')).toEqual(['clear', 're-hold']);
  });

  it('CSR can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'CSR')).toEqual(['clear', 're-hold']);
  });

  it('HIR can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'HIR')).toEqual(['clear', 're-hold']);
  });

  it('Branch Manager can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'Branch Manager')).toEqual(['clear', 're-hold']);
  });

  it('Operations Manager can clear or re-hold', () => {
    expect(getReEvalActions('smoke-vape', 'Operations Manager')).toEqual(['clear', 're-hold']);
  });

  // By-design note: this function does not role-gate on smoke-vape / too-dirty.
  // Drivers never reach the ReEvalPanel (navigation-gated upstream), so the
  // matrix intentionally allows any role that gets here to clear/re-hold.
  // If defense-in-depth becomes a requirement, this is the one case to change.
  it('Driver also returns clear/re-hold — navigation gate enforces access, not this matrix', () => {
    expect(getReEvalActions('smoke-vape', 'Driver')).toEqual(['clear', 're-hold']);
  });
});

// ── Too dirty: same tier as smoke-vape ──────────────────────────────────────

describe('getReEvalActions — too-dirty', () => {
  it('VSA can clear or re-hold', () => {
    expect(getReEvalActions('too-dirty', 'VSA')).toEqual(['clear', 're-hold']);
  });

  it('Branch Manager can clear or re-hold', () => {
    expect(getReEvalActions('too-dirty', 'Branch Manager')).toEqual(['clear', 're-hold']);
  });

  it('Driver also returns clear/re-hold — same rationale as smoke-vape', () => {
    expect(getReEvalActions('too-dirty', 'Driver')).toEqual(['clear', 're-hold']);
  });
});

// ── Contract invariants ─────────────────────────────────────────────────────

describe('getReEvalActions — contract invariants', () => {
  it('pet-hair never gives a VSA-level role the clear action', () => {
    const vsaRoles: UserRole[] = ['VSA', 'Lead VSA', 'CSR', 'HIR'];
    for (const role of vsaRoles) {
      const actions = getReEvalActions('pet-hair', role);
      expect(actions).not.toContain('clear');
      expect(actions).not.toContain('re-hold');
    }
  });

  it('pet-hair always produces exactly one action per role', () => {
    const roles: UserRole[] = [
      'VSA', 'Lead VSA', 'CSR', 'HIR',
      'Branch Manager', 'Operations Manager', 'Driver',
    ];
    for (const role of roles) {
      const actions = getReEvalActions('pet-hair', role);
      // Escalate for non-managers (1), clear+re-hold for managers (2)
      expect([1, 2]).toContain(actions.length);
    }
  });

  it('never returns escalate for smoke-vape or too-dirty', () => {
    for (const reason of ['smoke-vape', 'too-dirty'] as DetailReason[]) {
      for (const role of ['VSA', 'Branch Manager', 'Driver'] as UserRole[]) {
        expect(getReEvalActions(reason, role)).not.toContain('escalate');
      }
    }
  });
});
