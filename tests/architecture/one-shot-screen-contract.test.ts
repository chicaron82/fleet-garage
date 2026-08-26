import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A ONE-SHOT screen must leave the history stack behind it.
//
// Aaron, 2026-08-26: *"after registering a vehicle… when I hit back, it takes me back into the form
// I completed where it tells me that something already exists with this info. could there be a way
// to block that and 'back' takes me to the last module I was on?"*
//
// `navigate` only ever PUSHED, so the submitted register form sat in the stack one entry back. It
// then re-ran its own duplicate check against the unit and plate still in its state, found the car
// IT had just created, and correctly reported a conflict. The form was never wrong — it should not
// have been reachable.
//
// ⚠️ WHY THIS IS A SOURCE CONTRACT AND NOT JUST A UNIT TEST. `historyWrite` is unit-tested, and
// passing those tests proves nothing about the defect he reported: the bug lived entirely in HOW
// App.tsx called navigate. A test of the primitive would have stayed green through the whole
// outage. This asserts the wiring — the thing that was actually broken.

const APP = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

/** The `onSuccess` handler of the REGISTER screen, as written.
 *
 *  ⚠️ Anchored inside `case 'register-vehicle':` on purpose. Two screens declare an
 *  `onSuccess={(vehicleId) => {` — the new-hold screen has one too, and it appears FIRST in the
 *  file. A plain indexOf silently inspected the wrong handler and reported this contract as broken
 *  when it was not. A source contract that matches the wrong source is worse than none. */
function registerOnSuccess(): string {
  const caseAt = APP.indexOf("case 'register-vehicle':");
  expect(caseAt, "the register-vehicle case is gone — did the screen get renamed?").toBeGreaterThan(-1);
  const start = APP.indexOf('onSuccess={(vehicleId) => {', caseAt);
  expect(start, 'register onSuccess not found — did the handler get renamed?').toBeGreaterThan(-1);
  const end = APP.indexOf('\n            }}', start);
  expect(end, 'could not find the end of the handler').toBeGreaterThan(start);
  return APP.slice(start, end);
}

describe('the submitted register form must not stay in the stack', () => {
  // ⭐ The extractor is asserted first, so a reshaped App.tsx cannot silently return an empty
  // string and make every assertion below vacuously true.
  it('can still find the handler it is about to inspect', () => {
    const body = registerOnSuccess();
    expect(body.length).toBeGreaterThan(80);
    expect(body).toContain('fromHold');
  });

  // ⭐⭐ THE REGRESSION. A bare `navigate({ name: 'fleet-master' })` here is exactly the line that
  // stacked a second Fleet entry on top of the form instead of leaving it.
  it('never pushes its way out — the Fleet path pops, the hold path replaces', () => {
    const body = registerOnSuccess();
    // Every navigate call in this handler must be a replace; anything else has to be goBack.
    const navCalls = [...body.matchAll(/navigate\(/g)];
    for (const m of navCalls) {
      const call = body.slice(m.index, body.indexOf('\n', m.index));
      expect(call, `a push survives in the register success path: ${call.trim()}`)
        .toContain('replace: true');
    }
    expect(body, 'the Fleet path must return him, not stack a new entry').toContain('goBack(');
  });

  // ⚠️ The hold path is a FORWARD move carrying the new vehicleId — a pop would land him on the
  // hold form without the car he just registered, which is a different bug wearing the same fix.
  it('carries the new vehicle forward when he came from a hold', () => {
    const body = registerOnSuccess();
    const holdBranch = body.slice(body.indexOf('fromHold'), body.indexOf('} else'));
    expect(holdBranch).toContain('vehicleId');
    expect(holdBranch).toContain('replace: true');
    expect(holdBranch).not.toContain('goBack(');
  });

  // ⚠️ And the depth-1 branch, which is the same defect one level down: goBack's fallback used to
  // PUSH, so backing out of a deep-linked screen stacked the fallback on top of the screen he had
  // just left — and the hardware back button then walked him forwards into it again. That is
  // verbatim the defect screenRouting.ts documents as already fixed for the in-app buttons.
  it('goBack\'s fallback replaces rather than pushing', () => {
    const start = APP.indexOf('const goBack = useCallback');
    expect(start).toBeGreaterThan(-1);
    const body = APP.slice(start, APP.indexOf('}, [navigate]);', start));
    expect(body).toContain('replace: true');
  });
});
