import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ⭐⭐ A CENSUS, not an assertion — the same shape as `vehicle-field-census`, and for the same reason.
//
// Aaron, 2026-09-15: *"some search fields don't have the x to clear… i can't catch everything. i try
// to keep consistent with things but each new addition forgets what came before it. so fields don't
// always have the same thing. i couldn't find everything so i instead gave you some examples for you
// to recognize this was a thing and to look for more."*
//
// ⚠️ THAT IS THE WHOLE PROBLEM STATED EXACTLY. The clear button was never missing from FG — it was in
// `HoldsView` and `NewHoldForm` from early on. It just never spread, and worse, the copies DRIFTED:
// Lost & Found's used `✕` U+2715 at `text-sm` with no aria-label, which is also why a sweep grepping
// for "Clear search" could not see it. Three different buttons in one app.
//
// ⭐ No test could catch that, because no single file is wrong. It only exists when you COMPARE
// surfaces — so the guard has to be a census over all of them, and the fix has to be a MECHANISM
// rather than a promise to remember.
const ROOT = process.cwd();

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (e.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Files whose typed field is FORM ENTRY, not a search/filter — a × there is noise, not help. Each
 * needs a REASON, not just an entry: an exemption without one is how a census becomes an allowlist.
 */
const NOT_A_SEARCH: Record<string, string> = {
  'DriverLiveForm.tsx':            'origin/destination on a trip form — typed once and submitted, not a filter over a list.',
  'AirportFlipSection.tsx':        'a free-text note on the flip row ("weed smell") — part of the record being written.',
  'PlateWatchCard.tsx':            'the plate and reason for a NEW watch — form entry; the watch is created, not filtered.',
  'VehicleDirectEditModal.tsx':    'unit/plate being EDITED on the record. A × next to a value he is correcting invites a mis-tap that blanks it.',
  'VehicleEditSuggestionSheet.tsx':'the proposed new unit/plate — same as the direct edit, a value under composition.',
  'EVAssetsTab.tsx':               'the unit a cable or adapter was LENT to — a fact being recorded, not a query.',
  'OdometerCapture.tsx':           'km off the dash — a reading, and it already has its own clear/correct affordance.',
};

/**
 * Reads like a search/filter box rather than a form field.
 *
 * ⚠️⚠️ THE aria-label HALF IS LOAD-BEARING, and the first cut did not have it. Matching only literal
 * `placeholder="Search…"` missed **`VehicleLookup`**, whose placeholder is a PROP
 * (`placeholder={placeholder}`) — and that component is the header 🔍, the scan sheet's typed
 * fallback, the airport flip and the closing inventory. **Five surfaces, and the census built to
 * protect search fields could not see the biggest one.**
 *
 * ⭐ Found on the second pass, 2026-09-15, the same day the pattern was written — because the regex
 * was written against the six files in front of me and reported as covering the class. A guard whose
 * reach is narrower than its claim is worse than no guard: it makes the gap look checked.
 */
const SEARCHY = /(placeholder|aria-label)=["'{`][^"'`}]*\b([Ss]earch|[Ll]ook up)\b/;

describe('every search field can be cleared, and every clear looks the same', () => {
  const files = tsxFiles(join(ROOT, 'src/components'))
    .filter(f => SEARCHY.test(readFileSync(f, 'utf8')));

  it('⭐ finds search fields at all — a census that matches nothing is not a census', () => {
    expect(files.length).toBeGreaterThan(4);
    // ⚠️ VehicleLookup is the one that proves the aria-label half works — a prop placeholder, and
    // five surfaces behind it. If this drops out, the census has quietly narrowed again.
    expect(files.some(f => f.endsWith('VehicleLookup.tsx'))).toBe(true);
  });

  it('⭐⭐ every search field has a Clear search button, or a NAMED reason it is not a search', () => {
    const missing = files.filter(f => {
      const base = f.split('/').pop()!;
      if (NOT_A_SEARCH[base]) return false;
      return !readFileSync(f, 'utf8').includes('aria-label="Clear search"');
    }).map(f => f.replace(ROOT + '/', ''));
    expect(missing, `These have a search field and no way to clear it. Add the × (copy any existing one — they are identical on purpose), or add the file to NOT_A_SEARCH with a reason:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  // ⚠️⚠️ AND EVERY SEARCH FIELD MUST BE NAMED. Fleet's, Issue Log's and Lost & Found's had a
  // placeholder and no `aria-label` — and a placeholder VANISHES the moment he types, leaving a
  // screen reader with an unnamed box. Every one of them was found the same way: the verify helper
  // could not target the field to render into it. ⭐ THE TOOLING COULD NOT REACH THEM FOR THE SAME
  // REASON A SCREEN READER COULD NOT, which is the most useful thing an accessibility gap can do.
  it('⚠️ every search field carries an aria-label — a placeholder is not a label', () => {
    const unnamed = files.filter(f => {
      const src = readFileSync(f, 'utf8');
      // ⚠️⚠️ EXCLUDE "Clear search" — found on the second pass, 2026-09-15, and it made this whole
      // assertion circular: every clear button is labelled "Clear search", which CONTAINS "search",
      // so the button satisfied the requirement meant for the INPUT. `HoldsView` and `NewHoldForm`
      // both passed with unnamed search boxes. **The thing that made a file match was also the thing
      // that cleared the requirement.**
      const labels = [...src.matchAll(/aria-label=["'{`]([^"'`}]*)["'`}]/g)].map(m => m[1]);
      return !labels.some(l => /\b([Ss]earch|[Ll]ook up)\b/.test(l) && !/^Clear search$/.test(l));
    }).map(f => f.split('/').pop());
    expect(unnamed, `Search fields with no aria-label — a placeholder disappears as soon as he types:\n  ${unnamed.join('\n  ')}`).toEqual([]);
  });

  // ⚠️ THE DRIFT HALF, and the one that would have caught Lost & Found. A button that exists but
  // looks different is how a house style quietly stops being one — and an unlabelled one is invisible
  // to a screen reader AND to the next person sweeping for it.
  it('⚠️ every clear button uses the same glyph and the same label', () => {
    const odd: string[] = [];
    for (const f of tsxFiles(join(ROOT, 'src/components'))) {
      const src = readFileSync(f, 'utf8');
      if (!src.includes('aria-label="Clear search"')) continue;
      // the × immediately around the labelled button — U+00D7, never U+2715 or an icon
      if (/aria-label="Clear search"[\s\S]{0,120}✕/.test(src)) odd.push(`${f.split('/').pop()} uses ✕ (U+2715) instead of × (U+00D7)`);
      if (/aria-label="Clear search"[\s\S]{0,200}text-sm leading-none/.test(src)) odd.push(`${f.split('/').pop()} uses text-sm instead of text-base`);
    }
    expect(odd, `Clear buttons have drifted apart:\n  ${odd.join('\n  ')}`).toEqual([]);
  });
});
