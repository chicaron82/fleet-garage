// The flourish, as a primitive.
//
// ⭐⭐ WHY IT EXISTS AT ALL: Aaron, 2026-09-04 — *"we stopped being unapologetically bougie.
// functional is boring."* The drift came from a hundred individually-defensible restraint
// arguments, so the fix is not a rule telling the next session to care: it is making the flourish
// cost ONE WORD at the call site. These tests pin the two properties that make that safe.
//
// ⚠️ The preference is MOCKED rather than provided: mounting the real provider would drag in auth
// and Supabase, and exporting the context to suit a test would widen a production API for a test's
// convenience. `useSparklesEnabled` is the narrow accessor that exists so this component can read
// the switch WITHOUT being able to throw.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const sparkles = { on: true };
vi.mock('../../src/context/PreferencesContext', () => ({
  useSparklesEnabled: () => sparkles.on,
}));

const { Sparkles } = await import('../../src/components/shared/Sparkles');

describe('Sparkles', () => {
  // ⭐ The call site says WHEN; the component says WHETHER. No caller can forget the preference,
  // because no caller is asked about it.
  it('renders the flourish when the preference is on', () => {
    sparkles.on = true;
    const { container } = render(<Sparkles />);
    expect(container.querySelectorAll('.fg-sparkle').length).toBeGreaterThan(0);
  });

  it('⭐ renders NOTHING when he has switched sparkles off', () => {
    sparkles.on = false;
    const { container } = render(<Sparkles />);
    expect(container.querySelector('.fg-sparkle')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  // ⚠️ Decoration only — a screen reader hears the news, never the confetti.
  it('is hidden from assistive technology', () => {
    sparkles.on = true;
    const { container } = render(<Sparkles />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.textContent?.replace(/✨/g, '')).toBe('');
  });

  // ⚠️⚠️ THE ONE THAT MATTERS MOST. `Toast` renders this, and `Toast` was a pure presentational
  // component before it did. If the flourish can throw, a decorative layer takes the news down with
  // it — so `useSparklesEnabled` never throws, and this is rendered with no provider at all.
  it('⚠️ never crashes its host when there is no preferences provider', () => {
    sparkles.on = true;
    expect(() => render(<Sparkles />)).not.toThrow();
  });
});