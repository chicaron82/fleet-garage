import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloseDriftNotice } from '../../src/components/washbay/CloseDriftNotice';

// Aaron, 2026-10-05: the close was saved at 22:23 with 0 cleans; MCM571 went on the inventory as a clean at 22:55.
describe('CloseDriftNotice', () => {
  it('⭐ names both sides — what the close says and what the inventory now shows', () => {
    render(<CloseDriftNotice saved={{ carsRemaining: 0, cleanNotPickedUp: 0 }} inventory={{ dirties: 0, cleans: 1 }} onUpdate={() => {}} />);
    expect(screen.getByRole('status').textContent).toMatch(/Close says 0 cleans · 0 dirties/);
    expect(screen.getByRole('status').textContent).toMatch(/Inventory now shows 1 clean · 0 dirties/);
  });

  it('the button asks to update — it does not save on its own', () => {
    const onUpdate = vi.fn();
    render(<CloseDriftNotice saved={{ carsRemaining: 2, cleanNotPickedUp: 0 }} inventory={{ dirties: 0, cleans: 1 }} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /update the close/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
