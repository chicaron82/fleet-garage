// Aaron, 2026-11-04: *"an explicit check to the added hours. ✅ If closing"*, then *"make it smart depending on when
// the hours are added? If I'm on a close and the additional hours is to help with the morning?"*
// (docs/ticket-plus-block-crew-tick.md)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftExtraBlocks } from '../../src/components/schedule/ShiftExtraBlocks';
import type { ExtraBlock } from '../../src/types';

const show = (blocks: ExtraBlock[], mainStart = '06:45', mainEnd = '15:15') => {
  const onChange = vi.fn();
  render(<ShiftExtraBlocks blocks={blocks} onChange={onChange} mainStart={mainStart} mainEnd={mainEnd} />);
  return onChange;
};

describe('⭐ the crew tick on a [+] block', () => {
  it('⭐ after an opening: offers Closing crew, unticked, and ticking stores it', () => {
    const onChange = show([{ start: '18:00', end: '21:00' }]);
    const box = screen.getByRole('checkbox', { name: 'Closing crew' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith([{ start: '18:00', end: '21:00', crew: 'closing' }]);
  });

  it('⭐ before a close: offers Opening crew', () => {
    show([{ start: '06:45', end: '10:00' }], '13:30', '22:00');
    expect(screen.getByRole('checkbox', { name: 'Opening crew' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Closing crew' })).toBeNull();
  });

  it('a saved tick shows ticked, and unticking clears it', () => {
    const onChange = show([{ start: '18:00', end: '21:00', crew: 'closing' }]);
    const box = screen.getByRole('checkbox', { name: 'Closing crew' });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith([{ start: '18:00', end: '21:00', crew: undefined }]);
  });

  it('no start time yet: no tick to offer', () => {
    show([{ start: '', end: '' }]);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
