import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { EffieWriteLike } from '../../src/lib/effieVehicleTrail';
import type { Proposal } from '../../api/_lib/holdProposal';

// The per-car half of Effie's provenance trail. Aaron, 2026-08-29, on the GLOBAL version of this
// list: *"having a badge persist at 12 reads as if i still need to do something with them"*. So the
// two properties this file guards are about what the surface DOES TO A PERSON, not about data:
// it must never wear a count badge, and it must be completely silent when there is nothing to say.

let ROWS: EffieWriteLike[] = [];
vi.mock('../../src/hooks/useVehicleEffieWrites', () => ({
  useVehicleEffieWrites: () => ROWS,
}));
vi.mock('../../src/context/ProfilesContext', () => ({
  useProfiles: () => new Map([
    ['u-effie', { id: 'u-effie', name: 'Effie' }],
    ['u-aaron', { id: 'u-aaron', name: 'Aaron' }],
  ]),
}));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

import { VehicleEffieTrail } from '../../src/components/vehicle/VehicleEffieTrail';

const write = (over: Partial<EffieWriteLike> = {}): EffieWriteLike => ({
  id: 'w1',
  kind: 'register_vehicle',
  proposal: { kind: 'register_vehicle', newVehicle: { plate: 'LUR132' } } as unknown as Proposal,
  source: 'keytag-batch',
  status: 'approved',
  createdAt: '2026-08-03T18:00:00Z',
  resolvedAt: '2026-08-03T18:02:00Z',
  proposedBy: 'u-effie',
  resolvedBy: 'u-aaron',
  ...over,
});

const mount = () => render(<VehicleEffieTrail vehicleId="v1" licensePlate="LUR132" />);
beforeEach(() => { ROWS = []; });

describe('VehicleEffieTrail', () => {
  // ⚠️ Almost every car has nothing here — 12 resolved writes across a 716-car fleet. An empty box
  // on every vehicle screen trains him to scroll past the one car that eventually has something.
  it('⚠️ renders NOTHING at all when Effie never touched this car', () => {
    const { container } = mount();
    expect(container).toBeEmptyDOMElement();
  });

  it('is collapsed on open — the record is not about Effie', () => {
    ROWS = [write()];
    mount();
    expect(screen.getByRole('button', { name: /Effie wrote to this record/i })).toBeInTheDocument();
    expect(screen.queryByText(/Registered the car/)).not.toBeInTheDocument();
  });

  it('opens to the detail on tap', () => {
    ROWS = [write()];
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Effie wrote to this record/i }));
    expect(screen.getByText('Registered the car')).toBeInTheDocument();
    expect(screen.getByText(/proposed by Effie/)).toBeInTheDocument();
    expect(screen.getByText(/approved by Aaron/)).toBeInTheDocument();
  });

  // ⭐⭐ THE WHOLE REASON THIS COMPONENT EXISTS. `VehicleChangeLog` says outright that it can never
  // name an actor — FG writes with the anon key under allow-all RLS. A resolved Effie proposal is
  // the one slice of the record's history where a proposer and an approver honestly exist.
  it('⭐ names WHO proposed and WHO resolved it — the half the change log cannot', () => {
    ROWS = [write({ proposedBy: 'u-effie', resolvedBy: 'u-aaron' })];
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Effie wrote/i }));
    expect(screen.getByText(/proposed by Effie · approved by Aaron/)).toBeInTheDocument();
  });

  // ⚠️ THE DEFECT THIS SURFACE WAS BUILT TO NOT REPEAT. A filled pill with a bold number is queue
  // grammar; colour does not talk it out of that. The header may say what it is, and must never
  // count.
  it('⚠️ wears NO count badge, at any number of rows', () => {
    ROWS = [write({ id: 'a' }), write({ id: 'b' }), write({ id: 'c' })];
    const { container } = mount();
    expect(container.querySelector('.rounded-full')).toBeNull();
    // The count may appear as prose in the sentence — never as a standalone pill.
    expect(screen.getByRole('button', { name: /Effie wrote to this record 3 times/i })).toBeInTheDocument();
  });

  it('says "once" rather than "1 times"', () => {
    ROWS = [write()];
    mount();
    expect(screen.getByRole('button', { name: /wrote to this record once/i })).toBeInTheDocument();
  });

  // A rejected proposal is kept and marked, not hidden: "Effie proposed this and a human said no"
  // is a real answer to "why doesn't the record say that".
  it('shows a rejected proposal as rejected rather than dropping it', () => {
    ROWS = [write({ status: 'rejected' })];
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Effie wrote/i }));
    // Two nodes legitimately carry the word — the status chip and the "rejected by" line.
    // Assert both explicitly rather than a loose match that trips over its own success.
    expect(screen.getByText('· rejected')).toBeInTheDocument();
    expect(screen.getByText(/proposed by Effie · rejected by Aaron/)).toBeInTheDocument();
  });
});
