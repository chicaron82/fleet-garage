import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BatchKeytagScan } from '../../src/components/holds/BatchKeytagScan';
import type { BatchKeytagState } from '../../src/hooks/useBatchKeytagStage';

// The component is a thin surface over useBatchKeytagStage (which does the network reads +
// staging); mock it so the render is driven by the state under test. The per-read decision
// is covered in tests/lib/planBatchStage.test.ts — this locks what the surface shows.
const state = vi.fn<() => BatchKeytagState>();
vi.mock('../../src/hooks/useBatchKeytagStage', () => ({
  useBatchKeytagStage: () => state(),
}));

const base: BatchKeytagState = {
  running: false, progress: null, results: [], stagedCount: 0,
  runBatch: vi.fn(), stageOffer: vi.fn(), reset: vi.fn(),
};

beforeEach(() => state.mockReset().mockReturnValue(base));

function expand() { fireEvent.click(screen.getByText(/Batch register key tags/)); }

/** Render with a patched hook state, already expanded — the result rows only exist when open. */
function mountWith(over: Partial<BatchKeytagState>) {
  state.mockReturnValue({ ...base, ...over });
  render(<BatchKeytagScan />);
  expand();
}

describe('BatchKeytagScan', () => {
  it('is collapsed by default — the attach button is hidden until expanded', () => {
    render(<BatchKeytagScan />);
    expect(screen.queryByText('Attach key tags')).not.toBeInTheDocument();
    expand();
    expect(screen.getByText('Attach key tags')).toBeInTheDocument();
  });

  it('while running shows progress and disables the button', () => {
    state.mockReturnValue({ ...base, running: true, progress: { done: 1, total: 3 } });
    render(<BatchKeytagScan />);
    expand();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Reading…')).toBeDisabled();
  });

  it('renders a row per result with its action badge and the staged summary', () => {
    state.mockReturnValue({
      ...base,
      stagedCount: 2,
      results: [
        { index: 0, plan: { plate: 'LFJ343', wasCorrected: false, action: 'register', detail: 'register Unit 5420773' }, staged: true, stageError: false },
        { index: 1, plan: { plate: 'LUR554', wasCorrected: true, rawPlate: 'LMR554', action: 'backfill', detail: 'backfill model Envista' }, staged: true, stageError: false },
        { index: 2, plan: { plate: 'LZM999', wasCorrected: false, action: 'skip', detail: 'already in the fleet — nothing to add' }, staged: false, stageError: false },
      ],
    });
    render(<BatchKeytagScan />);
    expand();
    expect(screen.getByText('LFJ343')).toBeInTheDocument();
    expect(screen.getByText('register')).toBeInTheDocument();
    expect(screen.getByText('backfill')).toBeInTheDocument();
    expect(screen.getByText('(read LMR554)')).toBeInTheDocument();
    expect(screen.getByText('skip')).toBeInTheDocument();
    expect(screen.getByText(/2 staged — approve or reject them in the queue below/)).toBeInTheDocument();
  });

  it('a finished run that staged nothing says so', () => {
    state.mockReturnValue({
      ...base, stagedCount: 0,
      results: [{ index: 0, plan: { plate: 'LZM999', wasCorrected: false, action: 'skip', detail: 'already in the fleet' }, staged: false, stageError: false }],
    });
    render(<BatchKeytagScan />);
    expand();
    expect(screen.getByText(/Nothing staged/)).toBeInTheDocument();
  });
});

// ⭐⭐ "ADD ANYWAY" — the row that used to be a dead end. Aaron, batch-uploading his camera roll on
// 2026-08-30: *"the tag should upload, and i can add the details myself from the tag by hand."* The
// key-tag photo rides through on the proposal, so a skip with no proposal discarded it — the MODEL's
// failure costing him the one artifact that hadn't failed.
describe('BatchKeytagScan — Add anyway', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    index: 0, staged: false, stageError: false,
    plan: {
      plate: 'LPU213', wasCorrected: false, action: 'skip' as const,
      detail: 'not in fleet, and the read is short of make/model/unit/year',
      offer: { proposal: {} as never, label: 'Add anyway — keeps the tag photo' },
    },
    ...over,
  });

  it('⭐ offers the button on a short read instead of a dead SKIP', () => {
    mountWith({ results: [row()] });
    expect(screen.getByRole('button', { name: /Add anyway/i })).toBeInTheDocument();
    // ⚠️ lowercase in the DOM — the uppercase is a CSS class. Matching 'SKIP' here would
    //    pass vacuously and assert nothing, which it did until this was caught.
    expect(screen.queryByText('skip')).not.toBeInTheDocument();
  });

  it('stages that ONE row when tapped', () => {
    const stageOffer = vi.fn();
    mountWith({ results: [row()], stageOffer });
    fireEvent.click(screen.getByRole('button', { name: /Add anyway/i }));
    expect(stageOffer).toHaveBeenCalledWith(0);
  });

  // ⚠️ A skip with nothing to offer must stay a plain skip — an already-in-fleet car has no photo
  // problem to solve, and a button there would invite a duplicate registration.
  it('⚠️ shows no button on a skip that carries no offer', () => {
    mountWith({ results: [row({ plan: { plate: 'LUR302', wasCorrected: false, action: 'skip' as const, detail: 'already in the fleet — nothing to add' } })] });
    expect(screen.queryByRole('button', { name: /Add anyway/i })).not.toBeInTheDocument();
    expect(screen.getByText('skip')).toBeInTheDocument();
  });

  it('the button goes away once the row is staged', () => {
    mountWith({ results: [row({ staged: true })] });
    expect(screen.queryByRole('button', { name: /Add anyway/i })).not.toBeInTheDocument();
  });
});
