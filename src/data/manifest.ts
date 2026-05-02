// ── Rental Classes ────────────────────────────────────────────────────────────

export type RentalClass =
  | 'A'    // Economy (Kia Rio)
  | 'A6'   // Manager's Special (wildcard — not revenue-critical)
  | 'B'    // Small sedan (Versa)
  | 'B4'   // Small crossover (Kicks)
  | 'B5'   // Standard crossover (Corolla Cross)
  | 'C'    // Compact (Corolla)
  | 'D'    // Regular (VW Jetta)
  | 'F'    // Full Size (Camry)
  | 'E1'   // Non-Tesla EV (Niro)
  | 'E6'   // Standard hybrid
  | 'E7'   // Tesla Standard
  | 'E8'   // Tesla Dual Motor
  | 'E9'   // Tesla Model Y
  | 'Q4'   // SUV Compact AWD
  | 'L'    // SUV Standard (RAV4)
  | 'L2'   // SUV 6–7 seater (Explorer)
  | 'R'    // Minivan (Sienna)
  | 'S'    // Truck standard
  | 'T'    // Large SUV (Durango)
  | 'T4'   // Large SUV (Palisade)
  | 'T6'   // Largest SUV (Expedition)
  | 'O6';  // Mid-size truck (Frontier/Ranger) — one-way arrivals, transient in YWG

export interface ManifestReservation {
  id: string;
  time: string;           // "08:30" format
  customerName: string;
  rentalClass: RentalClass;
  duration: string;       // "1 day", "3 days", "1 week"
  pickupType: 'counter' | 'express';
}

// ── Season ────────────────────────────────────────────────────────────────────

export type Season = 'summer' | 'shoulder' | 'winter';

export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1–12
  if (month >= 5 && month <= 8)  return 'summer';
  if (month >= 11 || month <= 3) return 'winter';
  return 'shoulder';
}

export const SEASON_PRIORITY: Record<Season, RentalClass[]> = {
  summer: [
    'C', 'F', 'B', 'B4', 'B5',
    'R',
    'S', 'T', 'T4',
    'E6', 'E1',
    'Q4', 'L', 'L2',
    'E7', 'E8', 'E9',
    'T6', 'A6', 'O6',
  ],
  shoulder: [
    'C', 'F', 'Q4', 'L',
    'B', 'B4', 'B5', 'T', 'T4',
    'R', 'S', 'E6', 'E1',
    'L2', 'T6', 'E7', 'E8', 'E9', 'A6', 'O6',
  ],
  winter: [
    'Q4', 'L', 'L2',
    'T', 'T4', 'T6',
    'S',
    'C', 'F', 'B4', 'B5',
    'B',
    'E6',
    'E1', 'E7', 'E8', 'E9',
    'R',
    'A6', 'O6',
  ],
};

// ── Seeded PRNG (LCG) — deterministic per calendar date ───────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_NAMES = [
  'J. Thompson', 'M. Patel', 'S. Kowalski', 'A. Bergmann', 'R. Fontaine',
  'D. Okafor', 'L. Sinclair', 'T. Nakamura', 'B. Holloway', 'C. Reeves',
  'N. Bouchard', 'K. Andersen', 'P. Marchetti', 'F. Ibrahim', 'G. Santos',
];

const DURATIONS = ['1 day', '1 day', '1 day', '2 days', '3 days', '1 week'];
const PICKUP_TYPES: Array<'counter' | 'express'> = ['counter', 'counter', 'express'];

// All 30-min slots 06:00–21:30 (32 slots)
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots; // 32 slots
}

export function generateDayManifest(date: Date = new Date()): ManifestReservation[] {
  const season   = getCurrentSeason();
  const priority = SEASON_PRIORITY[season];

  // Seed from calendar date — same day always produces same manifest
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const rand = makePrng(seed);

  // Shuffle all 32 slots, take 28
  const slots = buildTimeSlots();
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const chosenSlots = slots.slice(0, 28).sort();

  // Class pools — A6 excluded from weighted draw, sprinkled separately
  const nonA6 = priority.filter(c => c !== 'A6');
  const top4  = nonA6.slice(0, 4);
  const next4 = nonA6.slice(4, 8);
  const rest  = nonA6.slice(8);

  const pickClass = (): RentalClass => {
    const r = rand();
    let pool: RentalClass[];
    if (r < 0.50)      pool = top4;
    else if (r < 0.80) pool = next4;
    else               pool = rest.length ? rest : top4;
    return pool[Math.floor(rand() * pool.length)];
  };

  const teslas = new Set<RentalClass>(['E7', 'E8', 'E9']);
  let a6Count = 0;

  const reservations: ManifestReservation[] = chosenSlots.map((time, i) => {
    let rentalClass = pickClass();

    // A6: max 2 per day
    if (rentalClass === 'A6') {
      rentalClass = a6Count < 2 ? 'A6' : top4[0];
      if (rentalClass === 'A6') a6Count++;
    }

    // Teslas: 70% swap-out in winter (cold-weather range concern)
    if (season === 'winter' && teslas.has(rentalClass) && rand() < 0.70) {
      rentalClass = top4[Math.floor(rand() * top4.length)];
    }

    return {
      id:           `res-${seed}-${i}`,
      time,
      customerName: MOCK_NAMES[Math.floor(rand() * MOCK_NAMES.length)],
      rentalClass,
      duration:    DURATIONS[Math.floor(rand() * DURATIONS.length)],
      pickupType:  PICKUP_TYPES[Math.floor(rand() * PICKUP_TYPES.length)],
    };
  });

  return reservations;
}

// ── Expected Returns ──────────────────────────────────────────────────────────

export interface ExpectedReturn {
  id: string;
  expectedTime: string;   // "14:00–15:00"
  rentalClass: RentalClass;
  customerName: string;
  duration: string;
}

function deriveReturnWindow(pickupTime: string): string {
  const [h, m] = pickupTime.split(':').map(Number);
  const start = Math.min(22, h + 1);
  const end   = Math.min(22, start + 1);
  return `${String(start).padStart(2, '0')}:${String(m).padStart(2, '0')}–${String(end).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function generateExpectedReturns(date: Date = new Date()): ExpectedReturn[] {
  const ago = (days: number) => { const d = new Date(date); d.setDate(date.getDate() - days); return d; };

  const oneDayReturns   = generateDayManifest(ago(1)).filter(r => r.duration === '1 day');
  const threeDayReturns = generateDayManifest(ago(3)).filter(r => r.duration === '3 days');
  const weekReturns     = generateDayManifest(ago(7)).filter(r => r.duration === '1 week');

  return [...oneDayReturns, ...threeDayReturns, ...weekReturns]
    .map(r => ({
      id:           `ret-${r.id}`,
      expectedTime: deriveReturnWindow(r.time),
      rentalClass:  r.rentalClass,
      customerName: r.customerName,
      duration:     r.duration,
    }))
    .sort((a, b) => a.expectedTime.localeCompare(b.expectedTime));
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getNextFiveNeeded(
  reservations: ManifestReservation[],
  now: Date = new Date(),
): ManifestReservation[] {
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return reservations
    .filter(r => r.time >= currentTime)
    .slice(0, 5);
}
