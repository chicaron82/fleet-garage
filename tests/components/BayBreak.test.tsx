// On break (migration 166, docs/ticket-lot-bay-on-break.md): one quiet button off a break, a strip with Back on one.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BayBreakButton, BayBreakStrip } from '../../src/components/lot/BayBreak';

describe('BayBreak', () => {
  it('On break is one tap', () => {
    const onBreak = vi.fn();
    render(<BayBreakButton onBreak={onBreak} />);
    fireEvent.click(screen.getByRole('button', { name: 'On break' }));
    expect(onBreak).toHaveBeenCalledOnce();
  });

  it('⭐ on a break: says what the read-only page shows, that any tap ends it, and Back', () => {
    const onBack = vi.fn();
    render(<BayBreakStrip onBack={onBack} />);
    expect(screen.getByRole('status').textContent).toMatch(/On break\. The read-only page says the count is paused\. Any tap ends it\./);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// Pulled away (2026-11-19, migration 171, docs/ticket-lot-bay-pulled-away.md). Aaron: *"What about a generic pause when
// pulled. Could be driving. Maybe a meeting or doing something else"*.
describe('BayBreak, pulled away', () => {
  it('⭐ the second button says Pulled away', () => {
    const onPull = vi.fn();
    render(<BayBreakButton kind="pulled" onBreak={onPull} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pulled away' }));
    expect(onPull).toHaveBeenCalledOnce();
  });

  it('⭐ pulled away, the strip names it, and Back still ends it', () => {
    const onBack = vi.fn();
    render(<BayBreakStrip kind="pulled" onBack={onBack} />);
    expect(screen.getByRole('status').textContent).toMatch(/^Pulled away\. The read-only page says the count is paused\. Any tap ends it\./);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// His note (2026-11-25, migration 172, docs/ticket-lot-bay-pulled-away-note.md). Aaron: *"adding a custom note to the
// read-only link when I get pulled away it's serves as a little heads up"*.
describe('BayBreak, pulled away with his note', () => {
  it('⭐ the strip offers a note field on Pulled away; Save sends it tidied', async () => {
    const onNote = vi.fn(async () => true);
    render(<BayBreakStrip kind="pulled" onBack={() => {}} onNote={onNote} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Note for the read-only page' }), { target: { value: '  Driving to the   airport ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onNote).toHaveBeenCalledWith('Driving to the airport'));
  });

  it('Save stays off until there is something to say', () => {
    render(<BayBreakStrip kind="pulled" onBack={() => {}} onNote={vi.fn(async () => true)} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('⭐ a break never offers a note', () => {
    render(<BayBreakStrip onBack={() => {}} onNote={vi.fn(async () => true)} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('⭐ with a note: shows what the read-only page says; Remove sends none', async () => {
    const onNote = vi.fn(async () => true);
    render(<BayBreakStrip kind="pulled" onBack={() => {}} note="Driving to the airport" onNote={onNote} />);
    expect(screen.getByText(/On the read-only page:/).textContent).toContain('“Driving to the airport”');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onNote).toHaveBeenCalledWith(null));
  });

  it('⭐ a recent note is one tap', async () => {
    const m = new Map([['fg.pulledAwayNotes', '["At a meeting, back soon"]']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
    const onNote = vi.fn(async () => true);
    render(<BayBreakStrip kind="pulled" onBack={() => {}} onNote={onNote} />);
    fireEvent.click(screen.getByRole('button', { name: 'At a meeting, back soon' }));
    await waitFor(() => expect(onNote).toHaveBeenCalledWith('At a meeting, back soon'));
    vi.unstubAllGlobals();
  });
});
