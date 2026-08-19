import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayShiftPhotos } from '../../src/components/washbay/DayShiftPhotos';

// The history disclosure for a past day's board photos. Covered as a component rather than through
// a real render because today's photo is deliberately absent from the history list (the section
// skips the current day), so there is no live past-day photo to point a browser at yet — his next
// close puts one there.
describe('DayShiftPhotos', () => {
  it('⭐ renders nothing at all when the day has no photo', () => {
    // The overwhelmingly common case: 30 rolling rows, and the trail starts today. An empty
    // disclosure on every row would train him to ignore the one row that eventually has something.
    const { container } = render(<DayShiftPhotos handoffUrl={null} closingUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('discloses without previewing — no image until he asks for one', () => {
    render(<DayShiftPhotos handoffUrl="https://example.test/handoff.jpg" closingUrl={null} />);
    expect(screen.getByText(/1 board photo/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('⭐ opens the FULL image, labelled by which log it came from', async () => {
    // A board at hand-off and a board at close are different moments of the same day, and knowing
    // which one you are looking at is most of the value.
    render(
      <DayShiftPhotos
        handoffUrl="https://example.test/handoff.jpg"
        closingUrl="https://example.test/close.jpg"
      />,
    );
    await userEvent.click(screen.getByText(/2 board photos/));
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('alt', 'The board at hand-off');
    expect(imgs[1]).toHaveAttribute('alt', 'The board at close');
    expect(screen.getByText(/Hand-off/)).toBeInTheDocument();
    expect(screen.getByText(/Close/)).toBeInTheDocument();
  });

  it('counts only the photos that exist', async () => {
    render(<DayShiftPhotos handoffUrl={null} closingUrl="https://example.test/close.jpg" />);
    await userEvent.click(screen.getByText(/1 board photo/));
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
