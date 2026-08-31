import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { KeytagPhoto } from '../../src/components/vehicle/KeytagPhoto';

const SRC = 'https://cdn/keytag.jpg';

/** jsdom reports 0×0 for every image, so the onLoad ratio has to be forced to test the swap. */
function loadWith(img: HTMLElement, w: number, h: number) {
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
  fireEvent.load(img);
}

// ⚠️⚠️ THESE EXIST BECAUSE THE UNIT TESTS THEY REPLACE ALL PASSED WHILE BOTH BUGS WERE LIVE.
// `rotationStyle`'s tests asserted the OBJECT it returned — correct transform, correct objectFit —
// and could not see what that object did once a caller spread it beside its own `width`. Aaron found
// both in a minute of use: *"rotating before zooming, goes over the keycount / rotating after
// zooming, i can't zoom in further."* [[feedback_verification_category_gap]]
describe('KeytagPhoto — the card thumbnail', () => {
  it('turns the photo', () => {
    render(<KeytagPhoto src={SRC} alt="tag" rotation={90} />);
    expect(screen.getByAltText('tag')).toHaveStyle({ transform: 'translate(-50%, -50%) rotate(90deg)' });
  });

  // ⚠️ THE FIX FOR "goes over the keycount". A transform does not reserve layout, so the turned
  // photo painted over the form below it. A square box fits every quarter-turn with no arithmetic,
  // and the clip guarantees nothing reaches the controls whatever the photo's shape.
  it('⚠️ sits in a square box that clips, so a turn can never reach the form', () => {
    const { container } = render(<KeytagPhoto src={SRC} alt="tag" rotation={90} />);
    const box = container.firstElementChild!;
    expect(box.className).toContain('aspect-square');
    expect(box.className).toContain('overflow-hidden');
  });

  it('an unrotated photo is still just the photo', () => {
    render(<KeytagPhoto src={SRC} alt="tag" rotation={0} />);
    expect(screen.getByAltText('tag')).toHaveStyle({ width: '100%' });
  });
});

describe('KeytagPhoto — the zoom stage', () => {
  // ⚠️⚠️ THE FIX FOR "i can't zoom in further". The old call was
  // `{ width: `${scale*100}%`, ...rotationStyle(rotation) }` — and a quarter-turn's `width: '100%'`
  // was spread AFTER the zoom width, silently overriding it. Taps still moved `scale`; nothing
  // moved on screen. Sizing and turning now come from one place, so they cannot fight.
  it('⭐ the zoom width survives a rotation', () => {
    const { container, rerender } = render(<KeytagPhoto src={SRC} alt="tag" rotation={0} scale={3} />);
    const box = () => container.querySelector('div')!;
    expect(box()).toHaveStyle({ width: '300%' });
    rerender(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={3} />);
    expect(box()).toHaveStyle({ width: '300%' });
  });

  it('every zoom step still changes the size at 90°', () => {
    const { container, rerender } = render(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={1} />);
    const box = () => container.querySelector('div')!;
    expect(box()).toHaveStyle({ width: '100%' });
    rerender(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={2} />);
    expect(box()).toHaveStyle({ width: '200%' });
    rerender(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={3} />);
    expect(box()).toHaveStyle({ width: '300%' });
  });

  // ⭐ The box declares the footprint the TURNED photo occupies — aspect inverted — so the scroll
  // container can see it and he can pan to the corner of a 3× tag, which is the point of zooming.
  it('⭐ the box carries the turned footprint, not the upright one', () => {
    const { container, rerender } = render(<KeytagPhoto src={SRC} alt="tag" rotation={0} scale={1} />);
    loadWith(screen.getByAltText('tag'), 400, 800);          // a portrait tag, ratio 0.5
    const box = () => container.querySelector('div')!;
    expect(box()).toHaveStyle({ aspectRatio: '0.5' });
    rerender(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={1} />);
    expect(box()).toHaveStyle({ aspectRatio: '2' });          // turned: it is now landscape
  });

  it('the image is drawn wide enough that its own height fills the turned box', () => {
    render(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={1} />);
    const img = screen.getByAltText('tag');
    loadWith(img, 400, 800);
    expect(img).toHaveStyle({ width: '50%' });   // ratio × 100
  });

  it('taps through to the caller so it can step the zoom', () => {
    const onClick = vi.fn();
    render(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={1} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  // ⚠️ A photo that has not loaded reports 0×0 in every browser for a moment. Ratio 1 is square,
  // which is the one shape where a turn is always safe — never NaN into the style.
  it('⚠️ a photo that has not loaded is treated as square, never NaN', () => {
    const { container } = render(<KeytagPhoto src={SRC} alt="tag" rotation={90} scale={1} />);
    loadWith(screen.getByAltText('tag'), 0, 0);
    expect(container.querySelector('div')).toHaveStyle({ aspectRatio: '1' });
  });
});
