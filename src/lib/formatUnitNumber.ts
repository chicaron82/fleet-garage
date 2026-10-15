/**
 * The unit number as the KEY TAG prints it — `5426408` → `542 6408`.
 *
 * ⭐ The space is not decoration: the tag groups the digits that way, so anything FG shows can be
 * checked against the tag at a glance. Aaron's own sheets are written like this, and on 2026-10-14
 * he asked for it everywhere: *"can we add a space in the unit numbers like how it's displayed on the
 * keytag?"* (Born in closingInventory for the closing sheet; moved here when every screen took it.)
 *
 * ⚠️ DISPLAY ONLY. Inputs, search and match keys, queries and text written to the database keep the
 * raw digits — a stored note must read the same as every note before it.
 *
 * ⚠️ Anything that is not seven digits passes through UNCHANGED rather than being regrouped into a
 * shape no tag ever printed (mocks are `HRZ-…`). A unit FG has never seen is null → '' — callers keep
 * their own placeholder, so this never invents one.
 */
export function formatUnitNumber(unit: string | null | undefined): string {
  const raw = (unit ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length === 7 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : raw;
}
