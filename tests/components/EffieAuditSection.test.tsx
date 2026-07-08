import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { EffieWriteAuditRow } from '../../src/hooks/useEffieWriteAudit';
import type { Profile } from '../../src/types';

// Mutable rows the mocked hook returns — set per test (vi.hoisted so the mock factory can see it).
const h = vi.hoisted(() => ({ rows: [] as EffieWriteAuditRow[] }));

vi.mock('../../src/hooks/useEffieWriteAudit', () => ({
  useEffieWriteAudit: () => ({ rows: h.rows, reload: vi.fn() }),
}));

const PROFILES = new Map<string, Profile>([
  ['u-aaron', { id: 'u-aaron', employeeId: 'E1', name: 'Aaron S.', role: 'VSA', branchId: 'YWG' }],
  ['u-geoff', { id: 'u-geoff', employeeId: 'E2', name: 'Geoff', role: 'Lead VSA', branchId: 'YWG' }],
]);
vi.mock('../../src/context/ProfilesContext', () => ({
  useProfiles: () => PROFILES,
}));

import { EffieAuditSection } from '../../src/components/pending/EffieAuditSection';

const APPROVED_REGISTER: EffieWriteAuditRow = {
  id: 'a1', kind: 'register_vehicle',
  proposal: { kind: 'register_vehicle', isTesla: false,
    newVehicle: { unitNumber: '5423827', plate: 'LZM554', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' } },
  source: 'effie-chat', status: 'approved',
  createdAt: '2026-07-08T18:00:00Z', resolvedAt: '2026-07-08T18:05:00Z',
  proposedBy: 'u-aaron', resolvedBy: 'u-geoff',
};

const REJECTED_HOLD: EffieWriteAuditRow = {
  id: 'r1', kind: 'hold',
  proposal: { kind: 'hold', vehicle: { vehicleId: 'v1', plate: 'LUR187', label: 'Unit 1 · Corolla' },
    holdType: 'Body', damageDescription: 'Scratch' },
  source: 'keytag-scan', status: 'rejected',
  createdAt: '2026-07-08T17:00:00Z', resolvedAt: '2026-07-08T17:02:00Z',
  proposedBy: 'u-aaron', resolvedBy: 'u-aaron',
};

beforeEach(() => { h.rows = []; });

describe('EffieAuditSection', () => {
  it('self-hides when there is no history', () => {
    h.rows = [];
    const { container } = render(<EffieAuditSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the count and renders each resolved write when expanded', () => {
    h.rows = [APPROVED_REGISTER, REJECTED_HOLD];
    render(<EffieAuditSection />);
    // Header + count badge always visible.
    expect(screen.getByText('Effie — write history')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // Collapsed by default — expand to see the rows.
    fireEvent.click(screen.getByText('Effie — write history'));
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByText(/Register · LZM554/)).toBeInTheDocument();
    expect(screen.getByText(/Hold · LUR187/)).toBeInTheDocument();
  });

  it('renders the provenance line: proposer, source, resolver', () => {
    h.rows = [APPROVED_REGISTER];
    render(<EffieAuditSection />);
    fireEvent.click(screen.getByText('Effie — write history'));
    // "proposed by Aaron S. · via effie-chat · approved by Geoff"
    expect(screen.getByText(/proposed by Aaron S\./)).toBeInTheDocument();
    expect(screen.getByText(/via effie-chat/)).toBeInTheDocument();
    expect(screen.getByText(/approved by Geoff/)).toBeInTheDocument();
  });
});
