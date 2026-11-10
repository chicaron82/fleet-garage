// docs/ticket-repair-outcome-windshield-only.md — Aaron, 2026-11-10, marking a PM done: *"Repaired clean and scar
// remains only showing for windshield damages"*.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepairConfirmSection } from '../../src/components/holds/RepairConfirmSection';
import { HoldRecordFooter } from '../../src/components/holds/HoldRecordFooter';
import { StatusBadge } from '../../src/components/holds/StatusBadge';
import { repairsDamage } from '../../src/lib/holdKinds';
import type { Hold } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

const hold = (over: Partial<Hold>): Hold => ({
  id: 'h-1', vehicleId: 'v-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: '', damageZones: [], notes: '',
  flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
  flaggedAt: '2026-11-01T14:00:00.000Z', status: 'ACTIVE', branchId: 'YWG', ...over,
} as Hold);
const confirm = (holds: Hold[]) => render(<RepairConfirmSection holds={holds} repairNotes='' setRepairNotes={vi.fn()}
  repairOutcome='clean' setRepairOutcome={vi.fn()} repairing={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);

const PM = hold({ holdTypes: ['mechanical'], holdType: 'mechanical', mechanicalSubType: 'pm-due', damageDescription: 'PM due' });
const CHIP = hold({ damageZones: ['windshield'], damageDescription: 'Chip' });

describe('the outcome picker asks only about glass', () => {
  it('a PM: no picker', () => {
    confirm([PM]);
    expect(screen.queryByText('Repair outcome')).toBeNull();
    expect(screen.queryByText(/scar remains/)).toBeNull();
  });

  it('a windshield chip (zone tapped): the picker', () => {
    confirm([CHIP]);
    expect(screen.getByText('Repair outcome')).toBeTruthy();
    expect(screen.getByText('Repaired — scar remains')).toBeTruthy();
  });

  it('a windshield named only in the note: the picker', () => {
    confirm([hold({ damageDescription: 'Cracked windshield, driver side' })]);
    expect(screen.getByText('Repair outcome')).toBeTruthy();
  });

  it('a door scratch: no picker', () => {
    confirm([hold({ damageZones: ['driver-front-door'], damageDescription: 'Scratch' })]);
    expect(screen.queryByText('Repair outcome')).toBeNull();
  });

  it('a batch with one windshield among them: the picker', () => {
    confirm([PM, CHIP]);
    expect(screen.getByText('Repair outcome')).toBeTruthy();
  });
});

describe("a finished hold's record names what was done", () => {
  const footer = (h: Hold, outcome: 'clean' | 'scar-remains') => render(<HoldRecordFooter
    hold={{ ...h, status: 'REPAIRED', repair: { id: 'r', holdId: h.id, repairedById: 'u-1', repairedAt: '2026-11-10T15:52:00Z', notes: '', outcome } } as Hold}
    getName={() => 'Aaron'} getRole={() => 'VSA'} getEmpId={() => 'E1'} fmt={s => s} fmtDate={s => s} />);

  it('542 2159: a PM reads Service done, never Damage Repaired', () => {
    footer(PM, 'clean');
    expect(screen.getByText(/Service done/)).toBeTruthy();
    expect(screen.queryByText(/Damage Repaired/)).toBeNull();
  });

  it('a detail reads Detail done', () => {
    footer(hold({ holdTypes: ['detail'], holdType: 'detail' }), 'clean');
    expect(screen.getByText(/Detail done/)).toBeTruthy();
  });

  it('damage keeps its words, scar and all', () => {
    footer(CHIP, 'scar-remains');
    expect(screen.getByText(/Repaired — Scar Remains/)).toBeTruthy();
  });
});

describe('the status badge on a finished hold', () => {
  it('a finished PM reads Done', () => {
    render(<StatusBadge status="REPAIRED" serviceOnly />);
    expect(screen.getByText('Done')).toBeTruthy();
  });
  it('a finished damage hold still reads Repaired', () => {
    render(<StatusBadge status="REPAIRED" serviceOnly={!repairsDamage(CHIP)} />);
    expect(screen.getByText('Repaired')).toBeTruthy();
  });
  it('an active hold is untouched by serviceOnly', () => {
    render(<StatusBadge status="ACTIVE" serviceOnly />);
    expect(screen.getByText('Active Hold')).toBeTruthy();
  });
});
