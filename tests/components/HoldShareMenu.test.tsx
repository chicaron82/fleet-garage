import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Hold, Vehicle } from '../../src/types';

// ⭐ "↗ Share" sends an IMAGE of the report now (Aaron, 2026-09-28: the old one mailed an empty
// about:blank page). The builder stays REAL (importOriginal) so the scope tests exercise the markup
// that actually ships; only the drawing and the share sheet are stubbed.
const img = vi.hoisted(() => ({
  renderHoldReportPng: vi.fn(async (r: { fileName: string }) => new File(['png'], r.fileName, { type: 'image/png' })),
  shareReportFile: vi.fn(async () => 'shared' as string),
}));
vi.mock('../../src/lib/holdReportImage', () => img);

const exportSpy = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/hold-export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/hold-export')>()),
  exportHoldToHtml: exportSpy,
}));

import { HoldShareMenu } from '../../src/components/holds/HoldShareMenu';

const VEHICLE = {
  id: 'v1', unitNumber: '5753165', licensePlate: 'OES646',
  make: 'Volkswagen', model: 'Jetta', year: 2025, color: 'Gray',
  status: 'PRE_EXISTING', branchId: 'YWG', isTesla: false,
  hasMobileCable: null, hasJ1772Adapter: null,
} as unknown as Vehicle;

function hold(id: string, flaggedAt: string, damageDescription: string): Hold {
  return {
    id, vehicleId: 'v1', status: 'RELEASED', damageDescription,
    holdType: 'damage', holdTypes: ['damage'],
    flaggedById: 'u1', flaggedByName: 'Aaron S.', flaggedAt,
  } as unknown as Hold;
}

const OLDER  = hold('h-old', '2026-04-27T23:47:00.000Z', 'Old scuff');
const LATEST = hold('h-new', '2026-06-08T16:54:00.000Z', 'New dent');
const noop = (id: string) => id;

/** The report card the image was drawn from, on the last share. */
const drawnCard = () => (img.renderHoldReportPng.mock.calls.at(-1)![0] as unknown as { card: string }).card;

describe('HoldShareMenu', () => {
  beforeEach(() => {
    img.renderHoldReportPng.mockClear(); img.shareReportFile.mockReset(); img.shareReportFile.mockResolvedValue('shared');
    exportSpy.mockClear();
  });

  it('⭐ shares the report as an image FILE — straight away when there is one record', async () => {
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[LATEST]} getName={noop} getEmpId={noop} />);
    await user.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => expect(img.shareReportFile).toHaveBeenCalledTimes(1));
    const [file, title] = img.shareReportFile.mock.calls[0] as unknown as [File, string];
    expect(file.name).toBe('hold-report-OES646.png');
    expect(title).toBe('Hold Report — Unit 5753165');
    expect(drawnCard()).toContain('New dent');
    expect(screen.queryByRole('button', { name: /full history/i })).not.toBeInTheDocument();
    expect(exportSpy).not.toHaveBeenCalled();                  // no about:blank tab any more
  });

  it('"Latest flag" draws only the most recently flagged record (by flaggedAt, not array order)', async () => {
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[OLDER, LATEST]} getName={noop} getEmpId={noop} />);
    await user.click(screen.getByRole('button', { name: /^↗ share$/i }));
    await user.click(screen.getByRole('button', { name: /latest flag/i }));

    await waitFor(() => expect(img.renderHoldReportPng).toHaveBeenCalledTimes(1));
    expect(drawnCard()).toContain('New dent');
    expect(drawnCard()).not.toContain('Old scuff');
  });

  it('"Full history" draws every record', async () => {
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[OLDER, LATEST]} getName={noop} getEmpId={noop} />);
    await user.click(screen.getByRole('button', { name: /^↗ share$/i }));
    await user.click(screen.getByRole('button', { name: /full history/i }));

    await waitFor(() => expect(img.renderHoldReportPng).toHaveBeenCalledTimes(1));
    expect(drawnCard()).toContain('New dent');
    expect(drawnCard()).toContain('Old scuff');
  });

  it('⚠️ when the phone wants a fresh tap, one more tap sends the SAME image', async () => {
    img.shareReportFile.mockResolvedValueOnce('needs-tap').mockResolvedValueOnce('shared');
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[LATEST]} getName={noop} getEmpId={noop} />);
    await user.click(screen.getByRole('button', { name: /share/i }));

    const send = await screen.findByRole('button', { name: /send report/i });
    await user.click(send);
    expect(img.shareReportFile).toHaveBeenCalledTimes(2);
    expect(img.renderHoldReportPng).toHaveBeenCalledTimes(1);   // not drawn twice
    await waitFor(() => expect(screen.getByRole('button', { name: /^↗ share$/i })).toBeInTheDocument());
  });

  it('⚠️ a failed image SAYS so and offers the printable page — never a silent nothing', async () => {
    img.renderHoldReportPng.mockRejectedValueOnce(new Error('canvas tainted'));
    const user = userEvent.setup();
    render(<HoldShareMenu vehicle={VEHICLE} holds={[LATEST]} getName={noop} getEmpId={noop} />);
    await user.click(screen.getByRole('button', { name: /share/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't make the report image/i);
    await user.click(screen.getByRole('button', { name: /open the printable page/i }));
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy.mock.calls[0][0].holds).toEqual([LATEST]);
  });
});
