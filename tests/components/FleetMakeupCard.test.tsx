import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FleetMakeupCard } from '../../src/components/analytics/FleetMakeupCard';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

// ⭐ Aaron asked for this card on 2026-09-19 and placed it himself: *"inside what FG has recorded"*.
// Sixteen makes and sixty model rows is a long thumb-drag at 412px, so the makes collapse — which
// makes "the models are hidden until he asks" a behaviour worth pinning, not a styling detail.

const car = (make: string, model: string, rentalClass: string | null) => ({ make, model, rentalClass });

const FLEET = [
  car('Nissan', 'Kicks', 'B4'), car('Nissan', 'Kicks', 'B5'), car('Nissan', 'Rogue', 'Q4'),
  car('Kia', 'Seltos', 'B5'),
];

describe('FleetMakeupCard', () => {
  it('lists the makes, biggest first, without their models', async () => {
    render(<FleetMakeupCard vehicles={FLEET} />);
    const makes = screen.getAllByRole('button').map(b => b.textContent);
    expect(makes[0]).toContain('Nissan');
    expect(makes[1]).toContain('Kia');
    expect(screen.queryByText('Kicks')).not.toBeInTheDocument();
  });

  it('a tap opens that make and shows its models with the classes they rent as', async () => {
    const user = userEvent.setup();
    render(<FleetMakeupCard vehicles={FLEET} />);
    await user.click(screen.getByRole('button', { name: /Nissan/ }));
    expect(screen.getByText('Kicks')).toBeInTheDocument();
    // ⭐ The straddle is the payload: one model, two classes, both shown.
    expect(screen.getByText('B4')).toBeInTheDocument();
    expect(screen.getByText('B5')).toBeInTheDocument();
  });

  it('opening another make closes the first — one open at a time on a phone', async () => {
    const user = userEvent.setup();
    render(<FleetMakeupCard vehicles={FLEET} />);
    await user.click(screen.getByRole('button', { name: /Nissan/ }));
    await user.click(screen.getByRole('button', { name: /Kia/ }));
    expect(screen.getByText('Seltos')).toBeInTheDocument();
    expect(screen.queryByText('Kicks')).not.toBeInTheDocument();
  });

  it('a second tap on the same make closes it', async () => {
    const user = userEvent.setup();
    render(<FleetMakeupCard vehicles={FLEET} />);
    const nissan = screen.getByRole('button', { name: /Nissan/ });
    await user.click(nissan);
    await user.click(nissan);
    expect(screen.queryByText('Rogue')).not.toBeInTheDocument();
  });

  // ⚠️ "holds", never "has available" — this counts the record, not the lot
  // (project_fg_attendance_observation_boundary).
  it('⚠️ says it counts what the branch HOLDS, not what is on the lot', () => {
    render(<FleetMakeupCard vehicles={FLEET} />);
    expect(screen.getByText(/not what is on the lot right now/i)).toBeInTheDocument();
  });

  it('renders nothing at all for an empty fleet', () => {
    const { container } = render(<FleetMakeupCard vehicles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
