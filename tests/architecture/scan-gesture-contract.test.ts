// The scan-router's file input must live at app scope (ScanRouterContext), never inside the overlay.
//
// ⚠️ WHY THIS EXISTS — tapping the header 📷 or the My Day card used to open the overlay onto a
// "Snap the key tag" prompt: a SECOND tap to reach the camera the first tap had already asked for.
// Aaron flagged it 2026-08-21 while using it on shift. The header's own comment claimed "scanning
// is one tap, not two" — and had been wrong since the entry points were added.
//
// ⭐ THE FIX IS A PLACEMENT, AND THAT'S WHY IT'S FRAGILE. Firing the camera from the first tap
// needs `input.click()` to run synchronously inside the user's gesture. The input therefore has to
// already be mounted when the tap arrives — but the overlay isn't mounted until the tap opens it.
// Moving the input into the provider (permanently mounted) is the whole mechanism.
//
// Put the input back inside ScanRouterOverlay and everything still compiles, every unit test still
// passes, and the e2e flows still pass — they inject post-scan state and never touch the input. The
// app just quietly returns to two taps, or worse, someone "fixes" it with an `input.click()` from a
// mount effect, which browsers block outright (Safari always, Chrome inconsistently) and which
// fails only on a real device, in his hand, at a car.
//
// So the placement is asserted mechanically rather than trusted to a comment.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const PROVIDER = 'src/context/ScanRouterContext.tsx';
const OVERLAY  = 'src/components/scan-router/ScanRouterOverlay.tsx';
const ENTRIES  = ['src/components/layout/AppShell.tsx', 'src/components/my-day/MyDayView.tsx'];

describe('scan-router: the camera opens on the first tap', () => {
  it('mounts the file input in the provider, outside the overlay\'s conditional render', () => {
    const src = read(PROVIDER);
    expect(src).toMatch(/type="file"/);
    expect(src).toMatch(/capture="environment"/);

    // The input must sit OUTSIDE `{isOpen && <ScanRouterOverlay .../>}` — inside it, it would
    // unmount with the overlay and there'd be nothing to click at tap time.
    //
    // ⚠️ HONEST LIMIT OF THIS ASSERTION (named at /reflect 60 rather than left to be over-trusted):
    // this checks SOURCE ORDER as a proxy for "always mounted". It reliably catches the realistic
    // regression — someone moving the input back into the overlay — because the overlay assertion
    // below fails too. It does NOT catch an input that sits before the overlay but inside a
    // conditional of its own (`{somethingElse && <input type="file" …/>}`), which would compile,
    // pass here, and still be unmounted at tap time. Parsing the JSX would close that gap; the
    // proxy is deliberate, and this comment exists so the next reader knows its edge.
    const overlayLine = src.indexOf('isOpen && <ScanRouterOverlay');
    const inputLine = src.indexOf('type="file"');
    expect(inputLine).toBeGreaterThan(-1);
    expect(overlayLine).toBeGreaterThan(-1);
    expect(src.slice(0, overlayLine)).toContain('type="file"');
    expect(inputLine).toBeLessThan(overlayLine);
  });

  it('fires the input synchronously from scan(), not from an effect', () => {
    const src = read(PROVIDER);
    const scanBody = src.slice(src.indexOf('const scan = useCallback'), src.indexOf('const close = useCallback'));
    expect(scanBody).toContain('fileRef.current?.click()');
    // A click scheduled through a timer or an effect has left the user gesture behind.
    expect(scanBody).not.toMatch(/setTimeout|requestAnimationFrame|useEffect/);
  });

  it('leaves no file input inside the overlay', () => {
    const src = read(OVERLAY);
    expect(src).not.toMatch(/type="file"/);
    expect(src).not.toMatch(/capture="environment"/);
  });

  it('reads one picked photo exactly once', () => {
    const src = read(OVERLAY);
    // Keyed on the nonce, and the ref is nulled before the read — re-running the effect (onFile is
    // re-created every render) must not re-read the tag: that costs an API call and a duplicate
    // sighting row.
    expect(src).toMatch(/pickedFileRef\.current = null;\s*\n\s*void onFile\(file\)/);
    expect(src).toMatch(/\}, \[pickedNonce/);
  });

  it('routes both entry points at scan(), never a bare open()', () => {
    for (const entry of ENTRIES) {
      const src = read(entry);
      expect(src).toContain('scanRouter.scan');
      expect(src).not.toContain('scanRouter.open');
    }
  });
});
