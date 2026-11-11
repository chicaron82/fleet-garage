// The one typed-lookup affordance.
//
// ⭐⭐ WHY IT EXISTS: Aaron, 2026-09-04 — *"i feel the look up should work like movement log… plate
// may be unreadable but you can still look up the unit right?… this isn't a new thing. its just
// applied differently."* Four surfaces answered *which car is this* four ways, and the only one that
// ever tried the UNIT NUMBER was the scan resolver — the one place least likely to need it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const searchVehicles = vi.fn();
vi.mock('../../src/lib/ev-detection', () => ({ searchVehicles }));

const { VehicleLookup } = await import('../../src/components/shared/VehicleLookup');

const CAR = {
  license_plate: 'LUR512', unit_number: '5426952', make: 'Volvo', model: 'XC60',
  year: 2026, color: 'Grey', is_hybrid: false, is_tesla: false,
};

// searchVehicles answers { matches, failed } since 2026-09-29 — an empty list can no longer mean
// both "no such car" and "the search died".
beforeEach(() => { vi.clearAllMocks(); searchVehicles.mockResolvedValue({ matches: [CAR], failed: false }); });

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(/Look up a vehicle/), { target: { value } });

describe('VehicleLookup', () => {
  it('suggests cars as he types, like the Movement Log', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR');
    await waitFor(() => expect(screen.getByText('LUR512')).toBeInTheDocument());
    expect(screen.getByText(/2026 Volvo XC60/)).toBeInTheDocument();
  });

  // ⭐ FG never resolves on a weaker key without saying which key did the work — the rule the scan
  // card already follows with `matchedByUnit`. A car found by its unit says so.
  it('⭐ names the unit when the UNIT is what matched, not the plate', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('5426');
    await waitFor(() => expect(screen.getByText(/unit 5426952/)).toBeInTheDocument());
  });

  it('does not say "unit" when the plate is what matched', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR5');
    await waitFor(() => expect(screen.getByText('LUR512')).toBeInTheDocument());
    expect(screen.queryByText(/unit 5426952/)).toBeNull();
  });

  it('hands the chosen car back to the caller', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    type('LUR');
    await waitFor(() => screen.getByText('LUR512'));
    fireEvent.click(screen.getByText('LUR512'));
    expect(onPick).toHaveBeenCalledWith({ vehicle: CAR });
  });

  // ⚠️ TYPED, THEREFORE NEVER CORRECTED — the misread corrector belongs under a camera, not under
  // his thumbs. Committing text that matched nothing is still a legitimate answer.
  it('hands back the raw text when he commits something with no match', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    type('lur 999');
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(onPick).toHaveBeenCalledWith({ typed: 'LUR999' });
  });

  // ⚠️ Two characters is the floor the shared query enforces; asking the database on every keystroke
  // of a one-letter prefix is a request for the whole fleet.
  it('does not search on a single character', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('L');
    await new Promise(r => setTimeout(r, 260));
    expect(searchVehicles).not.toHaveBeenCalled();
  });

  // ── inherited from ScanManualPlate, which this replaced ──────────────────────────────────────
  //
  // ⚠️ These five came ACROSS rather than dying with that file. A module's name is not its deletion
  // unit: the behaviours below are all still true of the thing that replaced it, and dropping the
  // file would have dropped their coverage silently while every remaining test stayed green.

  // ⭐ Always present, never an error-state rescue: a fallback you must FAIL first to discover is
  // one he would sit waiting on during a slow read instead of typing past.
  it('is offered before anything has gone wrong', () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    expect(screen.getByLabelText(/Look up a vehicle/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/if the scan is down/)).toBeInTheDocument();
  });

  it('takes Enter, because he is one-handed with a key tag in the other', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    type('LFJ679');
    fireEvent.keyDown(screen.getByLabelText(/Look up a vehicle/), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith({ typed: 'LFJ679' });
  });

  it('clears itself after committing, so the next car starts empty', () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR489');
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(screen.getByLabelText(/Look up a vehicle/)).toHaveValue('');
  });

  it('refuses an empty or whitespace-only entry', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    type('   ');
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText(/Look up a vehicle/), { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('stands down while a photo read is already in flight', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} busy />);
    type('LUR489');
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText(/Look up a vehicle/), { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
  });

  // ⚠️ A floating list inside a short scroll container is clipped by it. The scan sheet was 101px tall
  // and its suggestions opened outside it, so Aaron could only hit a sliver of the first row
  // (2026-09-10). Hosts like that ask for the list in flow; everyone else keeps the dropdown.
  it('floats its suggestions by default', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR');
    await waitFor(() => screen.getByText('LUR512'));
    expect(screen.getByRole('list')).toHaveClass('absolute');
  });

  it('puts the suggestions in flow when the host asks (inlineResults)', async () => {
    render(<VehicleLookup onPick={vi.fn()} inlineResults />);
    type('LUR');
    await waitFor(() => screen.getByText('LUR512'));
    expect(screen.getByRole('list')).not.toHaveClass('absolute');
  });
});

// ⭐⭐ Aaron, 2026-09-29, typing LFJ334 in full and getting silence: *"other times i'll start typing and
// nothing appears until i 'look up' then it will show me the vehicle i searched for."* The search had
// FAILED and rendered exactly like a car that does not exist. An empty list cannot mean two things.
describe('a search that could not run says so', () => {
  it('⭐ shows the failure and names the door that still works', async () => {
    searchVehicles.mockResolvedValue({ matches: [], failed: true });
    render(<VehicleLookup onPick={() => {}} />);
    type('LFJ334');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Couldn't search/i);
    expect(alert.textContent).toMatch(/Look up/);
  });

  it('⚠️ an honest MISS stays silent — the two must not look alike', async () => {
    searchVehicles.mockResolvedValue({ matches: [], failed: false });
    render(<VehicleLookup onPick={() => {}} />);
    type('ZZZ999');
    await new Promise(r => setTimeout(r, 400));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a recovered search drops the message and shows the car', async () => {
    searchVehicles.mockResolvedValue({ matches: [], failed: true });
    render(<VehicleLookup onPick={() => {}} />);
    type('LFJ33');
    expect(await screen.findByRole('alert')).toBeTruthy();
    searchVehicles.mockResolvedValue({ matches: [CAR], failed: false });
    type('LFJ334');
    expect(await screen.findByText(CAR.license_plate)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// Aaron, 2026-11-04, at the bay: *"The keyboard is blocking my fuzzy search results"*. A list opened behind the
// keyboard scrolls the field up; a list that fits never moves.
describe('⭐ the list stays above the keyboard', () => {
  const realScroll = Element.prototype.scrollIntoView;
  afterEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = realScroll;
    Reflect.deleteProperty(window, 'visualViewport');
  });
  const setup = (listBottom: number, visibleHeight: number) => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: listBottom } as DOMRect);
    Object.defineProperty(window, 'visualViewport', { configurable: true,
      value: { offsetTop: 0, height: visibleHeight, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    return scroll;
  };

  it('⭐ the list opens under the keyboard → the field scrolls to the top', async () => {
    const scroll = setup(700, 450);
    render(<VehicleLookup onPick={vi.fn()} />);
    type('0GY');
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' }));
  });

  // Aaron, 2026-11-11, under the past gas sheet's pinned photo: *"the results shows up but then immeditately
  // disappears"*. The field scrolled up to clear the header only, and the sticky photo covered it and the list.
  it('⭐ something pinned to the top (the gas sheet photo) → the field lands BELOW it, not under it', async () => {
    const scroll = setup(700, 450);
    render(<><div data-sticky-cover="" style={{ top: '56px' }} /><VehicleLookup onPick={vi.fn()} /></>);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 700, height: 300 } as DOMRect);
    type('0GY');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    const wrap = screen.getByLabelText(/Look up a vehicle/).closest('.scroll-mt-20') as HTMLElement;
    expect(wrap.style.scrollMarginTop).toBe('364px'); // stuck at 56 + 300 tall + 8 of air
  });

  it('nothing pinned → the header floor (80px), as before', async () => {
    const scroll = setup(700, 450);
    render(<VehicleLookup onPick={vi.fn()} />);
    type('0GY');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect((screen.getByLabelText(/Look up a vehicle/).closest('.scroll-mt-20') as HTMLElement).style.scrollMarginTop).toBe('80px');
  });

  it('the list fits above the keyboard → nothing moves', async () => {
    const scroll = setup(400, 450);
    render(<VehicleLookup onPick={vi.fn()} />);
    type('0GY');
    await waitFor(() => screen.getByText('LUR512'));
    expect(scroll).not.toHaveBeenCalled();
  });
});

// Aaron, 2026-11-11, entering a past gas sheet at the computer: *"when searching and multiple come up, i'd like to use
// the arrows to select the one i'm wanting"*. The arrows add a way to pick; Enter with nothing arrowed is unchanged.
describe('⭐ the arrow keys pick a car', () => {
  const CAR2 = { ...CAR, license_plate: 'LUR513', unit_number: '5426953', model: 'XC40' };
  const CAR3 = { ...CAR, license_plate: 'LUR514', unit_number: '5426954', model: 'XC90' };
  beforeEach(() => searchVehicles.mockResolvedValue({ matches: [CAR, CAR2, CAR3], failed: false }));
  const field = () => screen.getByLabelText(/Look up a vehicle/);
  const key = (k: string) => fireEvent.keyDown(field(), { key: k });
  const shown = async () => { type('LUR'); await waitFor(() => screen.getByText('LUR514')); };

  it('⭐ ↓ ↓ Enter picks the SECOND car', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    await shown();
    key('ArrowDown'); key('ArrowDown');
    expect(screen.getByText('LUR513').closest('button')).toHaveAttribute('data-active');
    key('Enter');
    expect(onPick).toHaveBeenCalledWith({ vehicle: CAR2 });
  });

  it('↓ stops at the last row; ↑ above the first hands Enter back to the typed text', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    await shown();
    for (let i = 0; i < 5; i++) key('ArrowDown');
    expect(screen.getByText('LUR514').closest('button')).toHaveAttribute('data-active');
    for (let i = 0; i < 5; i++) key('ArrowUp');
    expect(document.querySelector('[data-active]')).toBeNull();
    key('Enter');
    expect(onPick).toHaveBeenCalledWith({ typed: 'LUR' });
  });

  it('typing again drops the highlight, so a new search never carries an old pick', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    await shown();
    key('ArrowDown'); key('ArrowDown');
    type('LUR5');
    expect(document.querySelector('[data-active]')).toBeNull();
    key('Enter');
    expect(onPick).toHaveBeenCalledWith({ typed: 'LUR5' });
  });

  // jsdom never submits a form from a key event, so a spy on onSubmit would pass either way. What stops a real
  // browser's implicit submit is Enter's default being prevented; fireEvent returns false when it was.
  it('Enter in a host form picks the car and stops the form from also submitting', async () => {
    const onPick = vi.fn();
    render(<form><VehicleLookup onPick={onPick} /></form>);
    await shown();
    key('ArrowDown');
    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);
    expect(onPick).toHaveBeenCalledWith({ vehicle: CAR });
  });
});
