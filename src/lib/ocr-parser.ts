import { supabase } from './supabase';
import { lookupCodex } from '../data/ywgVehicleCodex';
import type { ScannedPayload } from '../types';

// Tesseract worker singleton — loaded once on first scan
let _worker: { recognize: (img: string) => Promise<{ data: TesseractData }> } | null = null;

interface TesseractWord {
  text: string;
  confidence: number;
}
interface TesseractData {
  text: string;
  words: TesseractWord[];
}

async function getWorker() {
  if (_worker) return _worker;
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  _worker = worker as unknown as typeof _worker;
  return _worker!;
}

// ── Pattern extractors ────────────────────────────────────────────────────────

function extractUnit(text: string): string | null {
  const m = text.match(/\b(\d{7})\b/);
  return m ? m[1] : null;
}

function extractCodexCode(text: string): string | null {
  const m = text.match(/\b(C[A-Z]{3})\b/);
  return m ? m[1] : null;
}

function extractPlate(text: string, excludeUnit: string | null): string | null {
  // Manitoba standard: 3 letters + 3 digits (e.g. LFR219)
  const words = text.toUpperCase().split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^A-Z0-9]/g, '');
    if (excludeUnit && clean === excludeUnit) continue;
    if (/^C[A-Z]{3}$/.test(clean)) continue; // skip codex codes
    if (/^[A-Z]{3}\d{3}$/.test(clean) || /^[A-Z]{2,3}\d{2,4}$/.test(clean)) {
      return clean;
    }
  }
  // Broader fallback: 5-8 chars alphanumeric that aren't the unit
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
        make: vehicle.make as string,
        model: vehicle.model as string,
        year: vehicle.year as number,
        color: vehicle.color as string,
      }
    : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseKeytag(imageDataUrl: string): Promise<ScannedPayload> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageDataUrl);

  const unit  = extractUnit(data.text);
  const code  = extractCodexCode(data.text);
  const plate = extractPlate(data.text, unit);

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

  // Codex fallback
  const codexEntry = code ? lookupCodex(code) : null;
  return {
    unitNumber:   unit  ?? '',
    licensePlate: plate ?? '',
    make:         codexEntry?.make  ?? '',
    model:        codexEntry?.model ?? '',
    year:         0,
    color:        '',
    needsReview:  true,
  };
}
