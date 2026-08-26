import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Toast } from '../../src/components/shared/Toast';

const bg = () => getComputedStyle(screen.getByRole('status')).backgroundColor;

describe('Toast', () => {
  it('announces itself politely rather than interrupting', () => {
    render(<Toast message="hi" variant="success" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('gives each kind of news its own colour', () => {
    const seen = new Set<string>();
    for (const v of ['success', 'notice', 'alert'] as const) {
      document.body.innerHTML = '';
      render(<Toast message="m" variant={v} />);
      seen.add(bg());
    }
    expect(seen.size).toBe(3);
  });

  // ⚠️ The fallback is ALERT, and it is named that on purpose. It used to be called `default`,
  // which invited call sites to omit it — and omitting it silently meant "this is a problem",
  // which is how a registration confirmation rendered on alert red for months. Red-on-omission is
  // still the safest fallback; the fix is that leaving it out now reads as a claim, not a shrug.
  it('falls back to alert, loudly, when nobody said', () => {
    document.body.innerHTML = '';
    render(<Toast message="m" />);
    const fallback = bg();
    document.body.innerHTML = '';
    render(<Toast message="m" variant="alert" />);
    expect(bg()).toBe(fallback);
  });
});
