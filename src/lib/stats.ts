// ── Manitoba Statutory Holidays ───────────────────────────────────────────────
// Federal + Manitoba-specific stats for Winnipeg location.
// Floating holidays computed algorithmically — works for any year.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// nth Monday of a given month (1-indexed)
function nthMonday(n: number, month: number, year: number): string {
  const first = new Date(year, month - 1, 1);
  const dow = first.getDay(); // 0=Sun
  const toFirstMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const day = 1 + toFirstMon + (n - 1) * 7;
  return iso(year, month, day);
}

// Last Monday on or before the given date
function lastMondayOnOrBefore(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day);
  const dow = d.getDay(); // 0=Sun, 1=Mon...
  const offset = dow === 0 ? 6 : dow - 1;
  return iso(year, month, day - offset);
}

// Easter Sunday — Anonymous Gregorian algorithm
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function goodFriday(year: number): string {
  const { month, day } = easterSunday(year);
  const d = new Date(year, month - 1, day - 2);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// Build stat map for a year: ISO date → holiday name
function buildStatMap(year: number): Map<string, string> {
  const m = new Map<string, string>();

  // Fixed federal
  m.set(iso(year, 1,  1),  "New Year's Day");
  m.set(iso(year, 7,  1),  'Canada Day');
  m.set(iso(year, 9,  30), 'National Day for Truth & Reconciliation');
  m.set(iso(year, 11, 11), 'Remembrance Day');
  m.set(iso(year, 12, 25), 'Christmas Day');

  // Manitoba-specific fixed — none beyond federal

  // Floating
  m.set(nthMonday(3, 2, year),              'Louis Riel Day');       // 3rd Mon of Feb
  m.set(goodFriday(year),                   'Good Friday');
  m.set(lastMondayOnOrBefore(year, 5, 24),  'Victoria Day');         // Last Mon on/before May 24
  m.set(nthMonday(1, 8, year),              'Terry Fox Day');        // 1st Mon of Aug
  m.set(nthMonday(1, 9, year),              'Labour Day');           // 1st Mon of Sep
  m.set(nthMonday(2, 10, year),             'Thanksgiving');         // 2nd Mon of Oct

  return m;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<number, Map<string, string>>();

function getStatMap(year: number): Map<string, string> {
  if (!cache.has(year)) cache.set(year, buildStatMap(year));
  return cache.get(year)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isStatDay(date: string): boolean {
  const year = parseInt(date.slice(0, 4), 10);
  return getStatMap(year).has(date);
}

export function getStatName(date: string): string | null {
  const year = parseInt(date.slice(0, 4), 10);
  return getStatMap(year).get(date) ?? null;
}
