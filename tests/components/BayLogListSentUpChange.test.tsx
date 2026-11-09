// ✈ Sent up and Change on the bay list (migration 167, docs/ticket-bay-sent-up-and-change-exit.md). Aaron, 2026-11-09:
// *"Editing a cleaned vehicle to M, B, or Erin afterwards"*, and *"something we cleaned was sent up right away and
// marking it as such"*. FG writes both; the read-only link shows the mark and the "was", and writes neither.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BayLogList, type BayListEdit } from '../../src/components/lot/BayLogList';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (exit: BayLogRow['exit'], over: Partial<BayLogRow> = {}): BayLogRow => ({
  id: 5, vehicle_id: 'v5', plate: 'LUR437', unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: '2026-11-09', started_at: '2026-11-09T18:50:00.000Z', exit, exited_at: '2026-11-09T18:56:00.000Z', note: null,
  hold_id: null, ...over,
});
const edit = (over: Partial<BayListEdit> = {}): BayListEdit => ({
  flagIds: new Set(), choicesFor: () => [], onNewHold: () => {}, onSameHold: async () => null, onNote: async () => null,
  onSentUp: async () => null, ...over,
});

describe('✈ Sent up', () => {
  it('⭐ a Clean line marks it in one tap', async () => {
    const onSentUp = vi.fn(async () => null);
    render(<BayLogList heading="Today" rows={[row('clean')]} edit={edit({ onSentUp })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark sent up' }));
    await waitFor(() => expect(onSentUp).toHaveBeenCalledWith(5, true));
  });
  it('a marked line reads "✈ sent up", and tapping it takes it back', async () => {
    const onSentUp = vi.fn(async () => null);
    render(<BayLogList heading="Today" rows={[row('clean', { sent_up: true })]} edit={edit({ onSentUp })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sent up. Tap to take it back' }));
    await waitFor(() => expect(onSentUp).toHaveBeenCalledWith(5, false));
  });
  it('only a Clean offers it', () => {
    render(<BayLogList heading="Today" rows={[row('erin')]} edit={edit()} />);
    expect(screen.queryByRole('button', { name: 'Mark sent up' })).toBeNull();
  });
  it('a refusal stays and says so', async () => {
    render(<BayLogList heading="Today" rows={[row('clean')]} edit={edit({ onSentUp: async () => 'Only a Clean goes up from the list.' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark sent up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a Clean goes up');
  });
  it('⭐ the read-only link shows the mark and has no button', () => {
    render(<BayLogList readOnly heading="Today" rows={[row('clean', { sent_up: true })]} />);
    expect(screen.getByText('✈ sent up')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sent up/i })).toBeNull();
  });
});

describe('Change', () => {
  it('⭐ Clean → B hold: asks in the line with the other three, then calls it', async () => {
    const onChangeExit = vi.fn(async () => null);
    render(<BayLogList heading="Today" rows={[row('clean')]} edit={edit({ onChangeExit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByText('Change LUR437 from Clean to:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clean' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'B hold' }));
    await waitFor(() => expect(onChangeExit).toHaveBeenCalledWith(5, 'bhold'));
  });
  it('Cancel closes it; a Bumped line, an earlier day and the read-only link have no Change', () => {
    const { unmount } = render(<BayLogList heading="Today" rows={[row('clean')]} edit={edit({ onChangeExit: async () => null })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/from Clean to/)).toBeNull();
    unmount();
    for (const ui of [
      <BayLogList heading="Today" rows={[row('skip')]} edit={edit({ onChangeExit: async () => null })} />,
      <BayLogList heading="Nov 8" rows={[row('clean')]} edit={edit()} />,
      <BayLogList readOnly heading="Today" rows={[row('clean')]} edit={edit({ onChangeExit: async () => null })} />,
    ]) {
      const r = render(ui);
      expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
      r.unmount();
    }
  });
  it('⭐ a changed line says what it was, on both screens', () => {
    const { unmount } = render(<BayLogList heading="Today" rows={[row('bhold', { was_exit: 'clean' })]} edit={edit()} />);
    expect(screen.getByText('was Clean')).toBeInTheDocument();
    unmount();
    render(<BayLogList readOnly heading="Today" rows={[row('clean', { was_exit: 'mhold' })]} />);
    expect(screen.getByText('was Held')).toBeInTheDocument();
  });
});
