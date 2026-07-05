// Which shift-day (YYYY-MM-DD) a timestamp belongs to, under the 04:00 Winnipeg
// cutover — the api-side mirror of src/lib/shiftDay.businessDateOf (the Vercel fn
// can't import src/). Intl handles DST, so this is pure string work: format the
// instant in Winnipeg, and anything before 04:00 rolls back to the previous day.
//
// The load-bearing subtlety this module's TEST pins: en-CA with hour12:false must
// yield "00".."23" (not an "01".."24" h24 cycle), or the `< 4` test would miss
// midnight and mis-file the whole midnight→04:00 mids window. Verified on Node ICU.

const SHIFT_TZ = 'America/Winnipeg'; // single-region YWG pilot
const CUTOVER_HOUR = 4;

/** The shift-day a timestamp falls in (04:00 Winnipeg cutover). Pure. */
export function shiftBusinessDate(ts: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: SHIFT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
    })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  );
  let [y, mo, d] = [Number(p.year), Number(p.month), Number(p.day)];
  if (Number(p.hour) < CUTOVER_HOUR) {
    const prev = new Date(Date.UTC(y, mo - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    [y, mo, d] = [prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate()];
  }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
