// YWG Hertz class-code → make/model lookup for the key-tag scan. A tag prints a class
// code (e.g. "CCVL 25") instead of the make/model; this maps it so the assistant can
// fill a registration from a photo. Mirrors docs/May/ywg-vehicle-codex.md (the living
// source of truth) — committed here because the proxy can't read the gitignored doc at
// runtime. When a new code surfaces on a tag, add it in both places; an unknown code
// returns null and the assistant asks for make/model instead of guessing.
//
// The model/year on the tag are read separately (year follows the code, e.g. "25" →
// 2025); this map is class → make + model only. Variant notes and years from the doc
// are stripped to a clean model name.

export interface VehicleClass {
  make: string;
  model: string;
}

const CODEX: Record<string, VehicleClass> = {
  // Toyota
  CCAM: { make: 'Toyota', model: 'Camry' },
  CCSE: { make: 'Toyota', model: 'Camry SE' },
  CCMH: { make: 'Toyota', model: 'Camry Hybrid' },
  CCRL: { make: 'Toyota', model: 'Corolla' },
  CCRC: { make: 'Toyota', model: 'Corolla Cross' },
  CCRH: { make: 'Toyota', model: 'Corolla Hatchback' },
  CCLH: { make: 'Toyota', model: 'Corolla Hybrid' },
  CRVB: { make: 'Toyota', model: 'RAV4' },
  CSLE: { make: 'Toyota', model: 'Sienna' },
  // Hyundai
  CELA: { make: 'Hyundai', model: 'Elantra' },
  CHVP: { make: 'Hyundai', model: 'Venue' },
  CKOP: { make: 'Hyundai', model: 'Kona' },
  CHPP: { make: 'Hyundai', model: 'Palisade' },
  CTAP: { make: 'Hyundai', model: 'Tucson' },
  // Kia
  CKSE: { make: 'Kia', model: 'Seltos' },
  CKVA: { make: 'Kia', model: 'Kicks' },
  CKNE: { make: 'Kia', model: 'Niro EV' },
  CCVL: { make: 'Kia', model: 'Carnival' },
  CFEX: { make: 'Kia', model: 'Forte' },
  CK4L: { make: 'Kia', model: 'K4' },
  CSOR: { make: 'Kia', model: 'Sorento' },
  CSOL: { make: 'Kia', model: 'Soul' },
  CSPT: { make: 'Kia', model: 'Sportage' },
  CSEH: { make: 'Kia', model: 'Sportage Hybrid' },
  // Nissan
  CKSV: { make: 'Nissan', model: 'Kicks' },
  CVSS: { make: 'Nissan', model: 'Versa' },
  CVRS: { make: 'Nissan', model: 'Versa' },
  CNSS: { make: 'Nissan', model: 'Sentra' },
  CSEN: { make: 'Nissan', model: 'Sentra' },
  CRSV: { make: 'Nissan', model: 'Rogue' },
  CROG: { make: 'Nissan', model: 'Rogue' },
  CALA: { make: 'Nissan', model: 'Altima' },
  CPT4: { make: 'Nissan', model: 'Pathfinder' },
  // Ford
  CUES: { make: 'Ford', model: 'Escape' },
  CEDG: { make: 'Ford', model: 'Edge' },
  CF1X: { make: 'Ford', model: 'F-150' },
  CXPX: { make: 'Ford', model: 'Explorer' },
  CELT: { make: 'Ford', model: 'Explorer' },
  CEST: { make: 'Ford', model: 'Explorer' },
  CFBS: { make: 'Ford', model: 'Bronco Sport' },
  CBOB: { make: 'Ford', model: 'Bronco Sport' },
  CFBO: { make: 'Ford', model: 'Bronco' },
  CXPD: { make: 'Ford', model: 'Expedition' },
  // Chevrolet
  CTXF: { make: 'Chevrolet', model: 'Trax' },
  CQRS: { make: 'Chevrolet', model: 'Equinox' },
  CMBU: { make: 'Chevrolet', model: 'Malibu' },
  CMLT: { make: 'Chevrolet', model: 'Malibu LT' },
  CTAV: { make: 'Chevrolet', model: 'Trailblazer' },
  // Tesla
  CTM3: { make: 'Tesla', model: 'Model 3' },
  CM3L: { make: 'Tesla', model: 'Model 3' },
  // Volvo
  CX96: { make: 'Volvo', model: 'XC90' },
  // Mazda
  CC5S: { make: 'Mazda', model: 'CX-5' },
  // Volkswagen
  CJCL: { make: 'Volkswagen', model: 'Jetta' },
  CTVA: { make: 'Volkswagen', model: 'Taos' },
  CATL: { make: 'Volkswagen', model: 'Atlas' },
  // Chrysler / Dodge
  CGCL: { make: 'Dodge', model: 'Grand Caravan' },
  CPCL: { make: 'Chrysler', model: 'Pacifica' },
  CDR8: { make: 'Dodge', model: 'Durango' },
  C300: { make: 'Chrysler', model: '300' },
  // Buick
  CEVS: { make: 'Buick', model: 'Envista' }, // surfaced live 2026-07-08 — didn't resolve, Aaron told Effie by hand
};

/** Resolve a Hertz class code (e.g. "CCVL", "ccvl 25") to its make/model, or null. */
export function lookupVehicleClass(code: string | undefined | null): VehicleClass | null {
  if (!code) return null;
  // Tolerate "CCVL 25" / "ccvl" / " CCVL " — take the leading letter+digit token.
  const key = code.trim().toUpperCase().split(/\s+/)[0];
  return CODEX[key] ?? null;
}
