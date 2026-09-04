// The sparkle layer on the toast.
//
// ⭐ Aaron asked for it, I argued against it on the numbers (a car new to FG turns up about seven
// times a day), and he overruled it and proposed the toggle himself. So the tests pin the two
// promises that survived that exchange: the flourish is OPT-OUT-able, and it is never the message.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../../src/components/shared/Toast';

describe('Toast', () => {
  it('shows the message and nothing else by default', () => {
    const { container } = render(<Toast message="Registered LUR330" variant="success" />);
    expect(screen.getByRole('status')).toHaveTextContent('Registered LUR330');
    expect(container.querySelectorAll('.fg-sparkle')).toHaveLength(0);
  });

  it('⭐ sparkles when the caller says the moment is rare', () => {
    const { container } = render(<Toast message="new to FG" variant="success" sparkle />);
    expect(container.querySelectorAll('.fg-sparkle').length).toBeGreaterThan(0);
  });

  // ⚠️ THE FLOURISH IS NEVER THE NEWS. A screen reader hears what happened, not the confetti.
  it('keeps the sparkles out of the accessible name', () => {
    render(<Toast message="new to FG" variant="success" sparkle />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('new to FG');
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  // ⚠️ The message must be identical with the flourish off — the toggle drops decoration, never
  // information. That is the whole reason it was safe to make it a switch instead of an argument.
  //
  // ⚠️⚠️ AND THE FIRST VERSION OF THIS TEST PROBED THE WRONG THING: it compared raw `textContent`,
  // which came back `new to FG — 775 on file✨✨✨✨✨`. `aria-hidden` removes a subtree from the
  // ACCESSIBILITY TREE, not from the DOM's text — so the assertion failed while the behaviour was
  // correct. Compare what a screen reader would actually get: the node's text minus the hidden layer.
  const spoken = (root: HTMLElement) => {
    const status = root.querySelector('[role="status"]')!.cloneNode(true) as HTMLElement;
    status.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
    return status.textContent;
  };

  it('says exactly the same thing with sparkles off', () => {
    const { container: on } = render(<Toast message="new to FG — 775 on file" variant="success" sparkle />);
    const { container: off } = render(<Toast message="new to FG — 775 on file" variant="success" />);
    expect(spoken(on)).toBe('new to FG — 775 on file');
    expect(spoken(on)).toBe(spoken(off));
  });
});
