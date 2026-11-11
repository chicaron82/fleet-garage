// The past gas sheet's pinned photo. Aaron, 2026-11-11: *"once i pin a gas sheet photo, can i move it around using the
// mouse instead of relying on the scrollbars"*. A mouse drag pans it; a click still zooms; a drag never toggles zoom.
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SheetPhotoPin } from '../../src/components/my-shift/SheetPhotoPin';

beforeAll(() => { URL.createObjectURL = () => 'blob:sheet'; URL.revokeObjectURL = () => {}; });

const pin = () => {
  render(<SheetPhotoPin />);
  fireEvent.change(screen.getByLabelText('Sheet photo'), { target: { files: [new File(['x'], 'sheet.jpg', { type: 'image/jpeg' })] } });
  const box = screen.getByTestId('sheet-photo');
  box.scrollLeft = 100; box.scrollTop = 100;
  return { box, img: screen.getByAltText('The gas sheet') };
};
const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 };

describe('SheetPhotoPin', () => {
  it('⭐ a mouse drag moves the photo the way the mouse went, like a map', () => {
    const { box, img } = pin();
    fireEvent.pointerDown(box, { ...mouse, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(box, { ...mouse, clientX: 170, clientY: 150 });
    fireEvent.pointerUp(box, mouse);
    expect([box.scrollLeft, box.scrollTop]).toEqual([130, 150]);
    fireEvent.click(img);
    expect(img.className).toContain('w-full'); // the drag's own click did not zoom
  });

  it('a click without moving still zooms, and the next one fits again', () => {
    const { box, img } = pin();
    fireEvent.pointerDown(box, { ...mouse, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(box, mouse);
    fireEvent.click(img);
    expect(img.className).toContain('w-[250%]');
    fireEvent.click(img);
    expect(img.className).toContain('w-full');
  });

  it('a finger is left to the browser: touch never moves the box by hand', () => {
    const { box } = pin();
    fireEvent.pointerDown(box, { ...mouse, pointerType: 'touch', clientX: 200, clientY: 200 });
    fireEvent.pointerMove(box, { ...mouse, pointerType: 'touch', clientX: 100, clientY: 100 });
    expect([box.scrollLeft, box.scrollTop]).toEqual([100, 100]);
  });

  it('marks itself as pinned to the top only while a photo is pinned', () => {
    const { container } = render(<SheetPhotoPin />);
    expect(container.querySelector('[data-sticky-cover]')).toBeNull();
    fireEvent.change(screen.getByLabelText('Sheet photo'), { target: { files: [new File(['x'], 's.jpg', { type: 'image/jpeg' })] } });
    expect(container.querySelector('[data-sticky-cover]')).not.toBeNull();
  });
});
