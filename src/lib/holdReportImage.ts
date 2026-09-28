// The hold report as a PICTURE, handed to the phone's share sheet.
//
// ⚠️ WHY (Aaron, 2026-09-28, on shift, testing a share before demoing FG): *"Tested the share. Is it
// supposed to be blank?"* "↗ Share" used to `window.open('')` + `document.write` — so the report lived
// in an `about:blank` tab, and the browser's own share could send only a title and an empty address.
// The email arrived as a subject line with nothing under it. docs/September/ticket-hold-report-shares-empty.md
//
// ⭐ An image because it is what the person on the other end can actually open: it lands in Gmail or
// Messages as the report itself, looking exactly like the screen he showed them.
//
// ⚠️ Photos are Supabase public-bucket URLs, served with `access-control-allow-origin: *` (checked
// 2026-09-28). That header is what lets them be drawn into the image — a bucket without it would
// render as holes, not errors.
import { toBlob } from 'html-to-image';
import type { HoldReport } from './hold-export';

/** Wide enough for two photos side by side, narrow enough to read on a phone without zooming. */
const REPORT_WIDTH = 640;

/** Wait for every <img> inside `node` to finish (or fail) — a half-loaded photo is a blank box. */
async function imagesSettled(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map(img => (img.complete
    ? Promise.resolve()
    : new Promise<void>(done => { img.onload = () => done(); img.onerror = () => done(); }))));
}

/**
 * Render the report card offscreen and rasterize it to a PNG file. The node is added to FG's own
 * document (that is what lets fonts and photos resolve) and always removed again, success or not.
 */
export async function renderHoldReportPng(report: HoldReport): Promise<File> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${REPORT_WIDTH}px;padding:16px;`
    + `background:#f3f4f6;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`;
  host.innerHTML = report.card;
  document.body.appendChild(host);
  try {
    await imagesSettled(host);
    // ⚠️⚠️ The `style` override is load-bearing. The host sits at left:-10000px to stay out of sight,
    // and html-to-image copies that onto the clone it draws — so the first real render (2026-09-28)
    // was a perfectly sized, perfectly EMPTY grey PNG: the report drawn ten thousand pixels outside
    // its own frame. Every mocked test passed. Only rendering it in a real browser showed it.
    const blob = await toBlob(host, {
      pixelRatio: 2, backgroundColor: '#f3f4f6',
      style: { position: 'static', left: '0', top: '0' },
    });
    if (!blob) throw new Error('The report could not be drawn as an image');
    return new File([blob], report.fileName, { type: 'image/png' });
  } finally {
    host.remove();
  }
}

/**
 * What happened when the image was offered:
 * - `shared` / `cancelled`: the share sheet opened (he sent it, or backed out — both are fine).
 * - `needs-tap`: the browser refused because too long passed since his tap while the image was being
 *   drawn (share needs a FRESH tap). The caller shows a second button so one more tap sends it.
 * - `downloaded`: this browser can't share files at all, so the PNG was saved instead.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'needs-tap' | 'downloaded';

export async function shareReportFile(file: File, title: string): Promise<ShareOutcome> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-tap';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
