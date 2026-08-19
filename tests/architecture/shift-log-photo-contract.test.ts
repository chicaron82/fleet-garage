// Regression suite for the WRITE-WITH-NO-READ class (found by Aaron, 2026-08-18).
//
// The photo field shipped on BOTH shift logs in one commit (`1c92130`) and only ONE of them ever
// got a way to look at the result. So every board photo taken at hand-off compressed, uploaded,
// saved to `handoff_notes.photo_url`, mapped back onto the HandoffNote object — and was rendered by
// nothing. No gate could see it: the upload succeeded, the row was correct, the types were sound,
// 2,000 tests stayed green. It surfaced only because he asked "does the photo I take of the board
// show up anywhere?"
//
// The contract this suite enforces: **a form that CAPTURES a shift-log photo must have a surface
// that DISPLAYS one.** Capture is `ShiftLogPhotoField`; display is `ShiftLogPhotoView`. Every
// capturing form is declared below with the component that reads its photo back, so a third shift
// log gaining a photo field fails the census until someone names where it will be seen.
//
// Source-text inspection like its siblings — cheap, no render infrastructure, fails at the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Every form that captures a shift-log photo → the component that renders it back. */
const CAPTURE_TO_DISPLAY: Record<string, string> = {
  'src/components/washbay/HandoffForm.tsx': 'src/components/my-shift/MyShiftView.tsx',
  'src/components/washbay/WashbayClosingLog.tsx': 'src/components/washbay/ClosingLogSummary.tsx',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const rel = (f: string) => f.slice(process.cwd().length + 1);
const renders = (f: string, tag: string) => readFileSync(f, 'utf8').includes(`<${tag}`);

describe('shift-log photo: every capture has a display', () => {
  it('CENSUS — no form captures a photo without a declared place to see it', () => {
    const capturing = files.filter(f => renders(f, 'ShiftLogPhotoField')).map(rel).sort();
    expect(
      capturing,
      'A form renders <ShiftLogPhotoField> but is not in CAPTURE_TO_DISPLAY. Name the component ' +
      'that shows the photo back — a capture with no display is the exact bug this suite exists for.',
    ).toEqual(Object.keys(CAPTURE_TO_DISPLAY).sort());
  });

  it('⭐ each declared display actually renders the photo', () => {
    for (const [capture, display] of Object.entries(CAPTURE_TO_DISPLAY)) {
      const full = join(process.cwd(), display);
      expect(
        renders(full, 'ShiftLogPhotoView'),
        `${display} is declared as the display for ${capture}, but does not render ` +
        `<ShiftLogPhotoView>. The photo would be written and never seen.`,
      ).toBe(true);
    }
  });

  it('the display component renders an <img>, not just a link', () => {
    // Guards the seasoning as well as the wiring: the point is that he can READ the key board, so
    // a bare "photo attached" link would technically satisfy the census and still fail the operator.
    const view = readFileSync(join(SRC, 'components/washbay/ShiftLogPhotoView.tsx'), 'utf8');
    expect(view).toMatch(/<img/);
  });
});
