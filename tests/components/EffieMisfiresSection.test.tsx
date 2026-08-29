import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EffieMisfiresSection } from '../../src/components/pending/EffieMisfiresSection';

// The section reads reason ids via useEffieMisfires (Supabase); mock it so the render is
// driven purely by the reasons under test. The grouping itself is covered in
// tests/lib/summarizeMisfires.test.ts — this locks the surface: self-hide + what shows.
const reasonIds = vi.fn<() => string[]>();
vi.mock('../../src/hooks/useEffieMisfires', () => ({
  useEffieMisfires: () => ({ reasonIds: reasonIds(), reload: vi.fn() }),
}));

beforeEach(() => reasonIds.mockReset());

describe('EffieMisfiresSection', () => {
  it('renders nothing when there are no rejections with reasons', () => {
    reasonIds.mockReturnValue([]);
    const { container } = render(<EffieMisfiresSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows read misfires with counts and their tuning lever (expanded)', () => {
    reasonIds.mockReturnValue(['wrong_class_code', 'wrong_class_code', 'wrong_plate']);
    render(<EffieMisfiresSection />);
    fireEvent.click(screen.getByText(/where she misfires/));
    expect(screen.getByText('Wrong model code')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('→ class codex')).toBeInTheDocument();
    expect(screen.getByText('→ plate prefix')).toBeInTheDocument();
  });

  it('separates non-misread rejects into the muted "Not misreads" line', () => {
    reasonIds.mockReturnValue(['duplicate', 'not_needed', 'not_needed']);
    render(<EffieMisfiresSection />);
    fireEvent.click(screen.getByText(/where she misfires/));
    // No read misfires → the honest fallback line, plus the non-misread tally.
    expect(screen.getByText(/No read misfires/)).toBeInTheDocument();
    const notMisreads = screen.getByText(/Not misreads:/);
    expect(notMisreads.textContent).toContain('Duplicate');
    expect(notMisreads.textContent).toContain('1');
    expect(notMisreads.textContent).toContain('Not needed');
    expect(notMisreads.textContent).toContain('2');
  });
});
