import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Hold, Vehicle } from '../../src/types';

const exportSpy = vi.fn();
vi.mock('../../src/lib/hold-export', () => ({
  exportHoldToHtml: (...args: unknown[]) => exportSpy(...args),
}));

import { HoldShareMenu } from '../../src/components/holds/HoldShareMenu';

const VEHICLE = {
  id: 'v1', unitNumber: '5753165', licensePlate: 'OES646',
  make: 'Volkswagen', model: 'Jetta', year: 2025, color: 'Gray',
  status: 'PRE_EXISTING', branchId: 'YWG', isTesla: false,
  hasMobileCable: null, hasJ1772Adapter: null,
} as unknown as Vehicle;

function hold(id: string, flaggedAt: string): Hold {
  return {
    id, vehicleId: 'v1', status: 'RELEASED',
    holdType: 'damage', holdTypes: ['damage'],
    flaggedById: 'u1', flaggedByName: 'Aaron S.', flaggedAt,
  } as unknown as Hold;
}

const OLDER  = hold('h-old', '2026-04-27T23:47:00.000Z');
const LATEST = hold('h-new', '2026-06-08T16:54:00.000Z');
const noop = (id: string) => id;

describe('HoldShareMenu', () => {
  beforeEach(() => exportSpy.mockClear());

  it('shares straight away (no menu) when there is only one record', async () => {
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[LATEST]} getName={noop} getEmpId={noop} />);

    await user.click(screen.getByRole('button', { name: /share/i }));

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy.mock.calls[0][0].holds).toEqual([LATEST]);
    expect(screen.queryByRole('button', { name: /full history/i })).not.toBeInTheDocument();
  });

  it('"Latest flag" shares only the most recently flagged record (by flaggedAt, not array order)', async () => {
    const user = userEvent.setup();
    // older first, latest second — proves the pick is by timestamp, not position
    render(<HoldShareMenu vehicle={VEHICLE} holds={[OLDER, LATEST]} getName={noop} getEmpId={noop} />);

    await user.click(screen.getByRole('button', { name: /^↗ share$/i }));
    await user.click(screen.getByRole('button', { name: /latest flag/i }));

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy.mock.calls[0][0].holds).toEqual([LATEST]);
  });

  it('"Full history" shares every record', async () => {
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[OLDER, LATEST]} getName={noop} getEmpId={noop} />);

    await user.click(screen.getByRole('button', { name: /^↗ share$/i }));
    await user.click(screen.getByRole('button', { name: /full history/i }));

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy.mock.calls[0][0].holds).toEqual([OLDER, LATEST]);
  });
});
