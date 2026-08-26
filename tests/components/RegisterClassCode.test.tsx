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

  // ⭐⭐ THE REGRESSION. Gating on teachClassCode means gating on FAILURE — the resolved-but-misread
  // code, which is the dangerous one, goes invisible again.
  it('does not gate the field on the codex having FAILED', () => {
    const at = FORM.indexOf('<RegisterClassCode');
    const before = FORM.slice(Math.max(0, at - 400), at);
    // The nearest preceding JSX condition must be the presence of a code, not teachClassCode.
    const cond = before.slice(before.lastIndexOf('{'));
    expect(cond, 'the model code is gated on a failed read again').not.toContain('teachClassCode');
    expect(cond).toContain('classCode');
  });

  // `teaching` still has to REACH it, or the amber "FG will learn this" state silently disappears.
  it('still tells it whether this registration teaches the codex', () => {
    const call = FORM.slice(FORM.indexOf('<RegisterClassCode'), FORM.indexOf('/>', FORM.indexOf('<RegisterClassCode')));
    expect(call).toContain('teaching=');
    expect(call).toContain('teachClassCode');
  });
});
