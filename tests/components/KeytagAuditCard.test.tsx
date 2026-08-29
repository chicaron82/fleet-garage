import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { KeytagAuditCard } from '../../src/components/vehicle/KeytagAuditCard';
import type { AuditCandidate } from '../../src/lib/keytagAuditQueue';
import type { Vehicle } from '../../src/types';

// ⭐ THE BEHAVIOUR THIS FILE EXISTS FOR. Aaron, first sitting with the auditor: *"having to flip
// back between image entering things read from the tag is tedious."* A Last9vin is small print, so
// he zooms to read it and has to drop the zoom to type it — five fields, five round trips per car,
// on the one feature whose whole value is the cycle being frictionless.
//
// So the test that matters is not "the overlay opens". It is: while the tag is full-screen, the
// inputs are REACHABLE, TYPEABLE, and the save carries what he typed there.

const vehicle = {
  id: 'v1', licensePlate: 'LUR202', make: 'Toyota', model: 'RAV4', year: 2026, color: 'White',
  status: 'CLEAR', branchId: 'YWG', keytagPhotoUrl: 'https://example.test/tag.jpg',
  owningArea: '8199', rentalClass: 'Q4', classCode: 'CCVL', unitNumber: '5420427', vinLast9: null,
} as unknown as Vehicle;

const candidate: AuditCandidate<Vehicle> = { vehicle, missing: ['vinLast9'] };

const onSave = vi.fn();
const onSkip = vi.fn();
const onFlag = vi.fn();
const KNOWN_CLASSES = new Set(['Q4', 'E9', 'P4', 'C', 'T']);
const KNOWN_CODES = new Set(['CRVB', 'CTMY']);
// Default: FG has never seen this unit's block, so no suggestion appears and the existing
// assertions stay about what they were about.
const noGuess = () => ({ prefix: '', tally: [], seen: 0, suggestion: null, ambiguous: false });
const setup = (guessOwning: Parameters<typeof KeytagAuditCard>[0]['guessOwning'] = noGuess) => render(
  <KeytagAuditCard candidate={candidate} saving={false}
    knownRentalClasses={KNOWN_CLASSES} knownModelCodes={KNOWN_CODES} guessOwning={guessOwning}
    onSave={onSave} onSkip={onSkip} onFlagUnreadable={onFlag} />,
);

const openZoom = () => fireEvent.click(screen.getByAltText(`Key tag for ${vehicle.licensePlate}`));
const overlay = () => screen.getByRole('dialog');

beforeEach(() => { onSave.mockClear(); onSkip.mockClear(); onFlag.mockClear(); });

describe('KeytagAuditCard — the card view', () => {
  it('seeds every field from the record so confirming is one tap', () => {
    setup();
    expect((screen.getByLabelText(/Owning area/) as HTMLInputElement).value).toBe('8199');
    expect((screen.getByLabelText(/Unit #/) as HTMLInputElement).value).toBe('5420427');
  });

  it('leaves a blank field blank rather than inventing a value', () => {
    setup();
    expect((screen.getByLabelText(/VIN \(last 9\)/) as HTMLInputElement).value).toBe('');
  });

  it('hands the whole edit set to save, not just what changed', () => {
    setup();
    fireEvent.click(screen.getByText('✓ Save & next'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ owningArea: '8199', classCode: 'CCVL' }));
  });
});

describe('KeytagAuditCard — typing on top of the zoomed tag', () => {
  it('⭐ renders the fields INSIDE the full-screen tag, not just the photo', () => {
    setup();
    openZoom();
    // The point of the whole change: five inputs reachable without leaving the tag.
    expect(within(overlay()).getAllByRole('textbox')).toHaveLength(5);
  });

  it('⭐ a value typed over the photo is what gets saved', () => {
    setup();
    openZoom();
    const vin = within(overlay()).getByLabelText(/VIN \(last 9\)/);
    fireEvent.change(vin, { target: { value: 'ABC123456' } });
    fireEvent.click(within(overlay()).getByText('✓ Save & next'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ vinLast9: 'ABC123456' }));
  });

  it('⭐ the two layouts share one form — typing in the overlay shows in the card', () => {
    // If they ever became two forms, this is the test that fails: a value typed in one place
    // vanishing from the other is exactly the drift the shared component prevents.
    setup();
    openZoom();
    fireEvent.change(within(overlay()).getByLabelText(/Rental class/), { target: { value: 'E6' } });
    fireEvent.click(within(overlay()).getByLabelText('Close the full-size tag'));
    expect((screen.getByLabelText(/Rental class/) as HTMLInputElement).value).toBe('E6');
  });

  it('can flag the photo unreadable without leaving it — that is where he sees it is bad', () => {
    setup();
    openZoom();
    fireEvent.click(within(overlay()).getByText("Can't read this"));
    expect(onFlag).toHaveBeenCalled();
  });

  it('hides the fields on request, for when the panel covers the line he is reading', () => {
    setup();
    openZoom();
    fireEvent.click(within(overlay()).getByTitle('Hide the fields'));
    expect(within(overlay()).queryAllByRole('textbox')).toHaveLength(0);
    fireEvent.click(within(overlay()).getByTitle('Show the fields'));
    expect(within(overlay()).getAllByRole('textbox')).toHaveLength(5);
  });

  it('steps the zoom 1× → 2× → 3× → 1× rather than pretending pinch works', () => {
    setup();
    openZoom();
    const tag = within(overlay()).getByAltText(/full size/);
    expect(tag.style.width).toBe('100%');
    fireEvent.click(tag);
    expect(tag.style.width).toBe('200%');
    fireEvent.click(tag);
    expect(tag.style.width).toBe('300%');
    fireEvent.click(tag);
    expect(tag.style.width).toBe('100%');
  });
});

describe('KeytagAuditCard — the wrong-box guard', () => {
  it('⭐ names a rental class typed into the model-code box', () => {
    // The defect that produced it: FVB4297's tag prints the heading `Class` above `E9`, and FG's
    // field used to be called `Class code`. Aaron had the domain exactly right and the label sent
    // it to the wrong column.
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'E9' } });
    expect(screen.getByText(/is a rental class/)).toBeTruthy();
  });

  it('⭐ warns but never blocks — Save still fires with what he typed', () => {
    // He typed E9 from KNOWING the car, not from reading it ("because its covered up"). A rule
    // that refuses a value he is certain of is worse than the bug it prevents.
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'E9' } });
    fireEvent.click(screen.getByText('✓ Save & next'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ classCode: 'E9' }));
  });

  it('⚠️ does NOT flag a bare "C" in the rental class — C is a real rental class', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Rental class/), { target: { value: 'C' } });
    expect(screen.queryByText(/is a model code/)).toBeNull();
  });

  it('⚠️⚠️ does NOT flag a spelled-out model — plenty of tags carry no code at all', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'SELTOS' } });
    expect(screen.queryByText(/⚠️/)).toBeNull();
  });

  it('flags a model code typed into the rental-class box — the same mistake, mirrored', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Rental class/), { target: { value: 'CRVB' } });
    expect(screen.getByText(/is a model code/)).toBeTruthy();
  });

  it('says nothing about a correct pair', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'CRVB' } });
    expect(screen.queryByText(/⚠️/)).toBeNull();
  });

  it('the hint describes the VALUE, not where it sits — the tag formats differ', () => {
    setup();
    expect(screen.getByText(/not every tag has one/)).toBeTruthy();
    expect(screen.getByText(/short size\/type group/)).toBeTruthy();
  });

  it('the guard reaches the overlay too, where he actually types', () => {
    setup();
    openZoom();
    fireEvent.change(within(overlay()).getByLabelText(/Model code/), { target: { value: 'E9' } });
    expect(within(overlay()).getByText(/is a rental class/)).toBeTruthy();
  });
});

describe('KeytagAuditCard — every value on a tag is uppercase', () => {
  // ⚠️ autoCapitalize="characters" steers a MOBILE keyboard and nothing else. On a real keyboard
  // `crvb` would have been stored lowercase beside two RAV4s carrying `CRVB` — codex lookups
  // normalise and would still resolve, but every exact match would silently miss the car.
  it('⭐ upper-cases as he types, in the card', () => {
    setup();
    const code = screen.getByLabelText(/Model code/) as HTMLInputElement;
    fireEvent.change(code, { target: { value: 'crvb' } });
    expect(code.value).toBe('CRVB');
  });

  it('⭐ upper-cases in the overlay too, where he actually types', () => {
    setup();
    openZoom();
    const vin = within(overlay()).getByLabelText(/VIN \(last 9\)/) as HTMLInputElement;
    fireEvent.change(vin, { target: { value: '3sc554212' } });
    expect(vin.value).toBe('3SC554212');
  });

  it('saves the upper-cased value, not what the keystrokes were', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'ctmy' } });
    fireEvent.click(screen.getByText('✓ Save & next'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ classCode: 'CTMY' }));
  });

  it('⭐ the guard sees what he SEES — a lower-cased rental class still trips it', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Model code/), { target: { value: 'e9' } });
    expect(screen.getByText(/is a rental class/)).toBeTruthy();
  });

  it('leaves digits alone — an owning area has no case to change', () => {
    setup();
    const area = screen.getByLabelText(/Owning area/) as HTMLInputElement;
    fireEvent.change(area, { target: { value: '8191' } });
    expect(area.value).toBe('8191');
  });
});

describe('KeytagAuditCard — nothing is required, and only one field is capped', () => {
  it('⭐ says out loud that a blank is allowed', () => {
    // Aaron read the blank-marker dot as a required-field asterisk and had to ask: *"if i don't
    // know it or can't read it, can i still leave it blank"*. A permission he has to infer from a
    // glyph is a permission he will get wrong.
    setup();
    expect(screen.getByText(/Nothing here is required/)).toBeTruthy();
  });

  it('⭐ no longer marks blank fields with a dot that reads as "required"', () => {
    setup();
    // The marker meant "blank on the record" but sat exactly where an asterisk goes. The label
    // tint carries the same signal and cannot be mistaken for a rule.
    expect(screen.queryByTitle('blank on the record')).toBeNull();
  });

  it('caps the VIN at 9 — 426 stored VINs, every one exactly that length', () => {
    setup();
    expect(screen.getByLabelText(/VIN \(last 9\)/).getAttribute('maxLength')).toBe('9');
  });

  it('⚠️ does NOT cap the unit number — one live car carries 8 digits, not 7', () => {
    // 703 units are 7 characters and 4374 7498 is not. A cap that is right about 703 of 708 rows
    // still blocks real work — the same trap as the model-code shape rule.
    setup();
    expect(screen.getByLabelText(/Unit #/).getAttribute('maxLength')).toBeNull();
  });

  it('⚠️ does NOT cap the owning area — one is 5 characters (02294)', () => {
    setup();
    expect(screen.getByLabelText(/Owning area/).getAttribute('maxLength')).toBeNull();
  });

  it('the nothing-is-required line reaches the overlay too', () => {
    setup();
    openZoom();
    expect(within(overlay()).getByText(/Nothing here is required/)).toBeTruthy();
  });
});

describe('KeytagAuditCard — the owning-area suggestion', () => {
  // Aaron, working the queue: "anything with unit number 542**** or 549**** enter owning 8199,
  // vancouver 8191 and so on. the ones that i'll stop on are ones i'm unsure of."
  const confident = () => ({
    prefix: '557', tally: [{ owningArea: '8191', count: 11 }], seen: 11,
    suggestion: '8191', ambiguous: false,
  });
  const split = () => ({
    prefix: '577',
    tally: [{ owningArea: '8193', count: 6 }, { owningArea: '8199', count: 1 }],
    seen: 7, suggestion: '8193', ambiguous: true,
  });
  const evenSplit = () => ({
    prefix: '711',
    tally: [{ owningArea: '8198', count: 1 }, { owningArea: '8199', count: 1 }],
    seen: 2, suggestion: null, ambiguous: true,
  });

  it('⭐ offers the branch with its evidence, and does NOT touch the field', () => {
    // The fixture already holds 8199 and the block suggests 8191 — so this also proves the
    // suggestion cannot silently overwrite a value the record already has. An autofill here would
    // have replaced a real owning area and stamped the replacement 'manual', locked.
    setup(confident);
    const area = screen.getByLabelText(/Owning area/) as HTMLInputElement;
    expect(area.value).toBe('8199');
    expect(screen.getByText(/use 8191/)).toBeTruthy();
    expect(screen.getByText(/11 of 11 cars on 557/)).toBeTruthy();
  });

  it('replaces the value only when he taps', () => {
    setup(confident);
    expect((screen.getByLabelText(/Owning area/) as HTMLInputElement).value).toBe('8199');
    fireEvent.click(screen.getByText(/use 8191/));
    expect((screen.getByLabelText(/Owning area/) as HTMLInputElement).value).toBe('8191');
  });

  it('⭐ names the dissent on a split block — the one he should stop on', () => {
    setup(split);
    expect(screen.getByText(/1 say 8199/)).toBeTruthy();
  });

  it('⭐⭐ offers NOTHING on an even split, and says why', () => {
    // A silent autofill here would write the wrong branch and stamp it 'manual', locked.
    setup(evenSplit);
    expect(screen.queryByText(/use 8198/)).toBeNull();
    expect(screen.queryByText(/use 8199/)).toBeNull();
    expect(screen.getByText(/split block/)).toBeTruthy();
  });

  it('says nothing about a block FG has never seen', () => {
    setup();
    expect(screen.queryByText(/cars on/)).toBeNull();
    expect(screen.queryByText(/split block/)).toBeNull();
  });

  it('stops offering once the field already holds the suggestion', () => {
    setup(confident);
    fireEvent.click(screen.getByText(/use 8191/));
    expect(screen.queryByText(/use 8191/)).toBeNull();
  });

  it('reaches the overlay too, where he actually types', () => {
    setup(confident);
    openZoom();
    expect(within(overlay()).getByText(/use 8191/)).toBeTruthy();
  });
});
