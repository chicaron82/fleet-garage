// ⭐ CLEAR OF THE BAR UNDER IT. Aaron, 2026-10-14, on his Pixel 10: the keypad shrinks the sheet, the browser scrolls the
// box only JUST into view, and it lands flush against the sticky "Scan a tag" bar (8412c45 is the mis-tap that cost). So
// once the keypad has opened, the box moves to the middle of what is left. Two passes: the resize
// (`interactive-widget=resizes-content`) lands after the focus, and centring before it would centre in the old, taller
// sheet. Shared since 2026-11-02: the bay card's odo box has the same keypad and the same exits under it.
export function centreAfterKeypad(el: HTMLElement) {
  const centre = () => el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  centre();
  window.visualViewport?.addEventListener('resize', centre, { once: true });
  setTimeout(() => { window.visualViewport?.removeEventListener('resize', centre); centre(); }, 450);
}
