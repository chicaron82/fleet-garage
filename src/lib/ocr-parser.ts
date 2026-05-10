import { supabase } from './supabase';
import { lookupCodex } from '../data/ywgVehicleCodex';
import type { ScannedPayload } from '../types';

// Tesseract worker singleton — loaded once on first scan
let _worker: { recognize: (img: string, lang: string, options: Record<string, unknown>) => Promise<{ data: TesseractData }> } | null = null;

interface TesseractWord {
  text: string;
  confidence: number;
}
interface TesseractData {
  text: string;
  words: TesseractWord[];
}

// Keytag format from photo:
//   WINNIPEG
//   08199  C
//   Veh #:
//   542 6408          ← unit has a space: 3+4 digits
//   Last9vin:
//   3RE813928
//   Lic Plate
//   LFJ279
//   CFEX 24           ← code + 2-digit year on same line
//   WHI 4DR           ← color abbreviation

const TESSERACT_OPTIONS = {
  tessedit_pageseg_mode: '11',  // sparse text — best for constrained tag layout
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 #:.',
};

// ── Color abbreviation map ────────────────────────────────────────────────────

const COLOR_ABBREV: Record<string, string> = {
  WHI: 'White', BLK: 'Black', SIL: 'Silver', GRY: 'Gray',
  RED: 'Red',   BLU: 'Blue',  GRN: 'Green',  GLD: 'Gold',
  BRN: 'Brown', ORG: 'Orange',PRP: 'Purple', TAN: 'Tan',
};

function resolveColor(abbrev: string): string {
  return COLOR_ABBREV[abbrev.toUpperCase()] ?? abbrev;
}

// ── Worker ────────────────────────────────────────────────────────────────────

async function getWorker() {
  if (_worker) return _worker;
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  _worker = worker as unknown as typeof _worker;
  return _worker!;
}

// ── Pattern extractors ────────────────────────────────────────────────────────

// Unit: "Veh #:" label anchor first, then 3+space+4 or plain 7-digit fallback
function extractUnit(text: string): string | null {
  // Label-anchored: "Veh #:" followed by digits (with optional space)
  const labeled = text.match(/Veh\s*#\s*:?\s*(\d{3})\s*(\d{4})/i);
  if (labeled) return labeled[1] + labeled[2];

  // 3-digit space 4-digit pattern (the split format on the tag)
  const split = text.match(/\b(\d{3})\s(\d{4})\b/);
  if (split) return split[1] + split[2];

  // Plain 7-digit fallback
  const plain = text.match(/\b(\d{7})\b/);
  return plain ? plain[1] : null;
}

// Code: "C" + 3 uppercase letters — anchored by being on line with 2-digit year
function extractCodeAndYear(text: string): { code: string; year: number } | null {
  // "CFEX 24" or "CKSE 25" on same line
  const m = text.match(/\b(C[A-Z]{3})\s+(\d{2})\b/);
  if (m) return { code: m[1], year: 2000 + parseInt(m[2]) };

  // Code without year
  const codeOnly = text.match(/\b(C[A-Z]{3})\b/);
  if (codeOnly) return { code: codeOnly[1], year: 0 };

  return null;
}

// Plate: "Lic Plate" label anchor first, then Manitoba pattern fallback
function extractPlate(text: string, excludeUnit: string | null): string | null {
  // Label-anchored: "Lic Plate" followed by the plate on next line/token
  const labeled = text.match(/Lic\s+Plate\s*:?\s*([A-Z0-9]{5,8})/i);
  if (labeled) return labeled[1].toUpperCase();

  // Manitoba pattern: 3 letters + 3 digits (LFJ279)
  const words = text.toUpperCase().split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^A-Z0-9]/g, '');
    if (excludeUnit && clean === excludeUnit) continue;
    if (/^C[A-Z]{3}$/.test(clean)) continue;
    if (/^[A-Z]{3}\d{3}$/.test(clean)) return clean;
  }

  // Broader fallback: 5-8 char alphanumeric
  for (const w of words) {
    const clean = w.replace(/[^A-Z0-9]/g, '');
    if (clean.length >= 5 && clean.length <= 8 && /[A-Z]/.test(clean) && /\d/.test(clean)) {
      if (excludeUnit && clean === excludeUnit) continue;
      if (/^C[A-Z]{3}$/.test(clean)) continue;
      return clean;
    }
  }
  return null;
}

// Color: "WHI 4DR" — first 3-letter word on that line
function extractColor(text: string): string | null {
  // Look for a known color abbreviation near a door count ("4DR", "2DR")
  const m = text.match(/\b([A-Z]{3})\s+\d+DR\b/i);
  if (m) return resolveColor(m[1]);

  // Fallback: check for any known abbreviation
  const upper = text.toUpperCase();
  for (const abbrev of Object.keys(COLOR_ABBREV)) {
    if (new RegExp(`\\b${abbrev}\\b`).test(upper)) return COLOR_ABBREV[abbrev];
  }
  return null;
}

function minConfidence(words: TesseractWord[], target: string): number {
  const upper = target.replace(/\s/g, '').toUpperCase();
  const matches = words.filter(w =>
    w.text.replace(/\s/g, '').toUpperCase().includes(upper) ||
    upper.includes(w.text.replace(/\s/g, '').toUpperCase())
  );
  if (matches.length === 0) return 50;
  return Math.min(...matches.map(w => w.confidence));
}

// ── Vehicle lookup chain ──────────────────────────────────────────────────────

async function lookupVehicle(plate: string | null, unitNumber: string | null) {
  if (!plate && !unitNumber) return null;

  let vehicleIdResult: string | null = null;

  if (plate) {
    const { data } = await supabase
      .from('vehicle_identifiers')
      .select('vehicle_id')
      .eq('plate', plate.toUpperCase())
      .maybeSingle();
    vehicleIdResult = (data?.vehicle_id as string | null) ?? null;
  }

  if (!vehicleIdResult && unitNumber) {
    const { data } = await supabase
      .from('vehicle_identifiers')
      .select('vehicle_id')
      .eq('unit_number', unitNumber)
      .maybeSingle();
    vehicleIdResult = (data?.vehicle_id as string | null) ?? null;
  }

  if (!vehicleIdResult) return null;

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, year, color')
    .eq('id', vehicleIdResult)
    .single();

  return vehicle
    ? {
        vehicleId: vehicle.id as string,
        make:      vehicle.make  as string,
        model:     vehicle.model as string,
        year:      vehicle.year  as number,
        color:     vehicle.color as string,
      }
    : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseKeytag(imageDataUrl: string): Promise<ScannedPayload> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageDataUrl, 'eng', TESSERACT_OPTIONS);

  const unit        = extractUnit(data.text);
  const codeAndYear = extractCodeAndYear(data.text);
  const plate       = extractPlate(data.text, unit);
  const color       = extractColor(data.text);

  const unitConf  = unit  ? minConfidence(data.words, unit)  : 0;
  const plateConf = plate ? minConfidence(data.words, plate) : 0;
  const needsReview = unitConf < 70 || plateConf < 70;

  // Lookup chain: vehicle_identifiers → vehicles table
  const dbMatch = await lookupVehicle(plate, unit);
  if (dbMatch) {
    return {
      vehicleId:    dbMatch.vehicleId,
      unitNumber:   unit  ?? '',
      licensePlate: plate ?? '',
      make:         dbMatch.make,
      model:        dbMatch.model,
      year:         dbMatch.year,
      color:        dbMatch.color,
      needsReview,
    };
  }

  // Codex fallback — use year and color from tag text
  const codexEntry = codeAndYear ? lookupCodex(codeAndYear.code) : null;
  return {
    unitNumber:   unit  ?? '',
    licensePlate: plate ?? '',
    make:         codexEntry?.make  ?? '',
    model:        codexEntry?.model ?? '',
    year:         codeAndYear?.year ?? 0,
    color:        color ?? '',
    needsReview:  true,
  };
}
