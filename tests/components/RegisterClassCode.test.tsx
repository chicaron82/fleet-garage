import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegisterClassCode } from '../../src/components/vehicle/RegisterClassCode';

// Aaron, 2026-08-26: "when something gets scanned and needs to be registered to FG. the model code
// isn't here to confirm it was read correctly. only after when pulling up the vehicle can I
// read/edit it."
//
// ⭐⭐ THE INVERSION: the field used to render only when the codex FAILED. So an unresolvable code
// got a yellow box and a warning, while a MISREAD code that happens to RESOLVE got nothing —
// make/model filled in, looked right, nothing said the four characters were wrong.

const onChange = vi.fn();
beforeEach(() => onChange.mockClear());

const box = () => screen.getByTestId('register-class-code');
const input = () => screen.getByLabelText('🏷️ Model code');

describe('RegisterClassCode', () => {
  // ⭐⭐ THE REGRESSION — his exact car. CKVA resolves, so the old form showed nothing at all.
  it('shows a RESOLVED code, and what it resolves to', () => {
    render(<RegisterClassCode code="CKVA" onChange={onChange} teaching={false} />);
    expect(input()).toHaveValue('CKVA');
    expect(box()).toHaveTextContent('CKVA →');
    expect(box()).toHaveTextContent('Check it against the tag');
  });

  it('still warns loudly when registering will TEACH the code', () => {
    render(<RegisterClassCode code="CZZZ" onChange={onChange} teaching />);
    expect(box()).toHaveTextContent('New to FG');
    expect(box()).toHaveTextContent('teaches CZZZ = this make and model');
  });

  it('is editable in both states — the whole point is correcting a misread', () => {
    for (const teaching of [true, false]) {
      document.body.innerHTML = '';
      onChange.mockClear();
      render(<RegisterClassCode code="CKVA" onChange={onChange} teaching={teaching} />);
      fireEvent.change(input(), { target: { value: 'ckvb' } });
      expect(onChange, String(teaching)).toHaveBeenCalledWith('CKVB');   // upper-cased as he types
    }
  });

  // ⚠️ A code the codex does not know, reached by EDITING rather than by a failed read, must say so
  // — otherwise correcting CKVA to a typo would look identical to correcting it to a real code.
  it('says when an edited code is unknown to the codex', () => {
    render(<RegisterClassCode code="CQQQ" onChange={onChange} teaching={false} />);
    expect(box()).toHaveTextContent("isn't in the codex");
  });

  // ⭐ Blank is a legitimate choice: learning nothing beats learning wrong.
  it('says what a blank code means rather than nagging', () => {
    render(<RegisterClassCode code="" onChange={onChange} teaching />);
    expect(box()).toHaveTextContent('FG learns nothing from this tag');
  });

  it('normalises before resolving, so a scruffy read still matches', () => {
    render(<RegisterClassCode code=" ckva " onChange={onChange} teaching={false} />);
    expect(box()).toHaveTextContent('CKVA →');
  });
});

// ⚠️ THE TESTS ABOVE WOULD ALL STAY GREEN IF THE FORM RE-GATED THE RENDER — they exercise the
// component in isolation, and the defect he reported was the GATE around it
// (`{scanned?.teachClassCode && …}`), which no isolated test can see. So the gate gets pinned
// where it lives. Same lesson as the routing fix earlier today: test the thing that was actually
// capable of being wrong.
describe('the form shows it whenever there is a code', () => {
  const FORM = readFileSync(join(process.cwd(), 'src/components/vehicle/RegisterVehicleForm.tsx'), 'utf8');

  it('renders RegisterClassCode at all', () => {
    expect(FORM).toContain('<RegisterClassCode');
  });

  // ⭐⭐ THE REGRESSION. Gating on teachClassCode ALONE means gating on FAILURE — the
  // resolved-but-misread code, which is the dangerous one, goes invisible again.
  //
  // ⚠️ THIS GUARD USED TO BAN THE SUBSTRING `teachClassCode` anywhere in the condition, which is
  // cruder than its own stated intent and fired on a correct fix (/line-check 2026-08-27). The
  // contract is not "never mention that field" — it is "show it whenever the SCAN carried a code,
  // from EITHER field". Banning the substring also permitted a second, opposite regression:
  // `{scanned?.classCode && …}` alone would have passed while hiding the unresolvable code, since
  // a codex MISS leaves `classCode` undefined and only `teachClassCode` set.
  //
  // So it asserts both halves explicitly. Stricter than the ban it replaces, and it forbids the
  // original defect (`{scanned?.teachClassCode && …}`) by requiring the resolved field too.
  it('shows the field whenever the scan carried a code — resolved OR unresolvable', () => {
    const at = FORM.indexOf('<RegisterClassCode');
    const before = FORM.slice(Math.max(0, at - 400), at);
    const cond = before.slice(before.lastIndexOf('{'));
    expect(cond, 'a RESOLVED code must still be shown — the misread-but-resolvable case is the dangerous one')
      .toContain('scanned?.classCode');
    expect(cond, 'an UNRESOLVABLE code must still be shown — that registration teaches the codex')
      .toContain('scanned?.teachClassCode');
  });

  // ⭐ And it must NOT be gated on the live draft. `{classCode.trim() && …}` unmounted the control
  // the moment he cleared the box — an input that vanishes mid-edit — and made the component's own
  // blank-state message ("FG learns nothing from this tag") unreachable dead code: the child had a
  // branch for empty, the parent guaranteed non-empty. Gate on the READ, edit freely.
  it('is gated on the scan, not on the draft the operator is still typing', () => {
    const at = FORM.indexOf('<RegisterClassCode');
    const cond = FORM.slice(Math.max(0, at - 400), at);
    const gate = cond.slice(cond.lastIndexOf('{'));
    expect(gate, 'clearing the box must not unmount the field').not.toMatch(/\bclassCode\.trim\(\)/);
  });

  // `teaching` still has to REACH it, or the amber "FG will learn this" state silently disappears.
  it('still tells it whether this registration teaches the codex', () => {
    const call = FORM.slice(FORM.indexOf('<RegisterClassCode'), FORM.indexOf('/>', FORM.indexOf('<RegisterClassCode')));
    expect(call).toContain('teaching=');
    expect(call).toContain('teachClassCode');
  });
});
