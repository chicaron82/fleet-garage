import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScanEvAssets } from '../../src/components/scan-router/ScanEvAssets';

// Aaron, 2026-08-26: "when I scan a Tesla, the assets should be treated like a key count. two check
// boxes. checked ✅ present. unchecked, missing."
//
// The gap it closes: the scan sheet already SHOWED EV status ("last seen missing the cable") and
// gave him no way to record what he found. The one place he opens the trunk was the one place he
// could not say what was in it.

const onSet = vi.fn();
beforeEach(() => onSet.mockClear());

const cable = () => screen.getByRole('checkbox', { name: 'Cable' });
const adapter = () => screen.getByRole('checkbox', { name: 'Adapter' });
const show = (v: { hasMobileCable: boolean | null; hasJ1772Adapter: boolean | null }, saving = false) =>
  render(<ScanEvAssets vehicle={v} onSet={onSet} saving={saving} />);

describe('ScanEvAssets', () => {
  it('renders what FG already has, checked for present', () => {
    show({ hasMobileCable: true, hasJ1772Adapter: false });
    expect(cable()).toHaveAttribute('aria-checked', 'true');
    expect(adapter()).toHaveAttribute('aria-checked', 'false');
  });

  // ⚠️⚠️ THE HONESTY RULE, and the reason this file exists. "Unchecked = missing" describes what a
  // box MEANS once he has decided — not what an unvisited row CLAIMS. If mounting wrote, every
  // Tesla he scanned and walked away from would silently report its kit gone: the exact trap the
  // register form had, where a control that answered itself on mount turned a glance into a false
  // assessment.
  it('writes NOTHING on mount, however the assets stand', () => {
    for (const v of [
      { hasMobileCable: null, hasJ1772Adapter: null },
      { hasMobileCable: true, hasJ1772Adapter: true },
      { hasMobileCable: false, hasJ1772Adapter: false },
    ]) {
      document.body.innerHTML = '';
      show(v);
      expect(onSet, JSON.stringify(v)).not.toHaveBeenCalled();
    }
  });

  // ⚠️ A never-assessed asset renders unchecked but is NOT a claim of missing — it becomes an
  // answer the moment he taps, and stays silent until then.
  it('shows a never-assessed asset unchecked without asserting it', () => {
    show({ hasMobileCable: null, hasJ1772Adapter: null });
    expect(cable()).toHaveAttribute('aria-checked', 'false');
    expect(onSet).not.toHaveBeenCalled();
  });

  // ⭐ The write takes BOTH — so toggling one must carry the other through untouched, or checking
  // the cable would silently un-report the adapter.
  it('toggling one carries the other through unchanged', () => {
    show({ hasMobileCable: false, hasJ1772Adapter: true });
    fireEvent.click(cable());
    expect(onSet).toHaveBeenCalledWith(true, true);
    onSet.mockClear();
    fireEvent.click(adapter());
    expect(onSet).toHaveBeenCalledWith(false, false);
  });

  it('a null asset toggles to present, not to null again', () => {
    show({ hasMobileCable: null, hasJ1772Adapter: null });
    fireEvent.click(cable());
    expect(onSet).toHaveBeenCalledWith(true, false);
  });

  it('stands down while a write is in flight', () => {
    show({ hasMobileCable: true, hasJ1772Adapter: true }, true);
    expect(cable()).toBeDisabled();
    fireEvent.click(cable());
    expect(onSet).not.toHaveBeenCalled();
  });
});
