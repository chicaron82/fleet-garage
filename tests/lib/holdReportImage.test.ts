import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const toBlob = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toBlob }));

import { renderHoldReportPng, shareReportFile } from '../../src/lib/holdReportImage';

// ⚠️ Aaron, 2026-09-28: the old share sent an EMPTY email. These pin that the image reaches the share
// sheet as a FILE, and what happens on every way that can go wrong. docs/September/ticket-hold-report-shares-empty.md

const REPORT = { title: 'Hold Report — Unit 5422852', card: '<div id="card">LUR300</div>', html: '', fileName: 'hold-report-LUR300.png' };
const file = () => new File(['x'], 'hold-report-LUR300.png', { type: 'image/png' });
const nav = navigator as unknown as Record<string, unknown>;

describe('renderHoldReportPng', () => {
  // ⚠️ Braces matter: `() => toBlob.mockReset()` RETURNS the mock, and vitest runs a function returned
  // from beforeEach as cleanup — it called toBlob() with no arguments after every test.
  beforeEach(() => { toBlob.mockReset(); });

  it('⭐ draws the card and returns a named PNG file', async () => {
    toBlob.mockImplementation(async (node: HTMLElement) => {
      expect(node.innerHTML).toContain('LUR300');                   // it drew THE REPORT, not a blank node
      return new Blob(['png'], { type: 'image/png' });
    });
    const f = await renderHoldReportPng(REPORT);
    expect(f.name).toBe('hold-report-LUR300.png');
    expect(f.type).toBe('image/png');
  });

  // ⚠️⚠️ The first REAL render was a blank grey PNG: the host hides at left:-10000px and html-to-image
  // copied that onto the clone, drawing the report outside its own frame. Mocks cannot see pixels, so
  // this pins the one thing that fixed it — the clone is drawn back at the origin.
  it('⚠️⚠️ draws the clone at the origin, not where the hidden host sits', async () => {
    toBlob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    await renderHoldReportPng(REPORT);
    const opts = toBlob.mock.calls[0][1] as { style?: Record<string, string> };
    expect(opts.style).toMatchObject({ position: 'static', left: '0', top: '0' });
  });

  it('⚠️ removes its offscreen node even when drawing fails', async () => {
    toBlob.mockRejectedValue(new Error('canvas tainted'));
    await expect(renderHoldReportPng(REPORT)).rejects.toThrow();
    expect(document.getElementById('card')).toBeNull();
  });

  it('⚠️ a null blob is a failure, not an empty file', async () => {
    toBlob.mockResolvedValue(null);
    await expect(renderHoldReportPng(REPORT)).rejects.toThrow(/could not be drawn/);
  });
});

describe('shareReportFile', () => {
  const saved = { canShare: nav.canShare, share: nav.share };
  afterEach(() => { nav.canShare = saved.canShare; nav.share = saved.share; vi.restoreAllMocks(); });

  it('⭐ hands the FILE to the share sheet — the thing the old share never did', async () => {
    const share = vi.fn(async () => {});
    nav.canShare = () => true; nav.share = share;
    const f = file();
    expect(await shareReportFile(f, REPORT.title)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [f], title: REPORT.title });
  });

  it('backing out of the sheet is not an error', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn(async () => { throw Object.assign(new Error(), { name: 'AbortError' }); });
    expect(await shareReportFile(file(), 't')).toBe('cancelled');
  });

  it('⚠️ a stale tap asks for one more tap rather than failing', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn(async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); });
    expect(await shareReportFile(file(), 't')).toBe('needs-tap');
  });

  it('any other refusal is thrown, so the caller can say so', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn(async () => { throw Object.assign(new Error('nope'), { name: 'DataError' }); });
    await expect(shareReportFile(file(), 't')).rejects.toThrow('nope');
  });

  it('a browser that cannot share files saves the PNG instead', async () => {
    nav.canShare = undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    expect(await shareReportFile(file(), 't')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});
