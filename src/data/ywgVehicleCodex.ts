export interface CodexEntry {
  make: string;
  model: string;
}

export const YWG_VEHICLE_CODEX: Record<string, CodexEntry> = {
  // Toyota
  CCAM: { make: 'Toyota',     model: 'Camry' },
  CCSE: { make: 'Toyota',     model: 'Camry SE' },
  CCMH: { make: 'Toyota',     model: 'Camry Hybrid' },
  CCRL: { make: 'Toyota',     model: 'Corolla' },
  CCRC: { make: 'Toyota',     model: 'Corolla Cross' },
  CCRH: { make: 'Toyota',     model: 'Corolla Hatchback' },
  CCLH: { make: 'Toyota',     model: 'Corolla Hybrid' },
  CRVB: { make: 'Toyota',     model: 'RAV4' },
  CSLE: { make: 'Toyota',     model: 'Sienna' },

  // Kia
  CKSE: { make: 'Kia',        model: 'Seltos' },
  CKNE: { make: 'Kia',        model: 'Niro EV' },
  CCVL: { make: 'Kia',        model: 'Carnival' },
  CFEX: { make: 'Kia',        model: 'Forte' },
  CK4L: { make: 'Kia',        model: 'K4' },
  CSOR: { make: 'Kia',        model: 'Sorento' },
  CSOL: { make: 'Kia',        model: 'Soul' },
  CSPT: { make: 'Kia',        model: 'Sportage' },

  // Nissan
  CKSV: { make: 'Nissan',     model: 'Kicks' },
  CKVA: { make: 'Nissan',     model: 'Kicks' },
  CVSS: { make: 'Nissan',     model: 'Versa' },
  CVRS: { make: 'Nissan',     model: 'Versa' },
  CNSS: { make: 'Nissan',     model: 'Sentra' },
  CSEN: { make: 'Nissan',     model: 'Sentra' },
  CRSV: { make: 'Nissan',     model: 'Rogue' },
  CROG: { make: 'Nissan',     model: 'Rogue' },
  CALA: { make: 'Nissan',     model: 'Altima' },
  CPT4: { make: 'Nissan',     model: 'Pathfinder' },

  // Ford
  CUES: { make: 'Ford',       model: 'Escape' },
  CEDG: { make: 'Ford',       model: 'Edge' },
  CF1X: { make: 'Ford',       model: 'F-150' },
  CXPX: { make: 'Ford',       model: 'Explorer' },
  CELT: { make: 'Ford',       model: 'Explorer' },
  CEST: { make: 'Ford',       model: 'Explorer' },
  CFBS: { make: 'Ford',       model: 'Bronco Sport' },
  CBOB: { make: 'Ford',       model: 'Bronco Sport' },
  CFBO: { make: 'Ford',       model: 'Bronco' },
  CXPD: { make: 'Ford',       model: 'Expedition' },

  // Chevrolet
  CTXF: { make: 'Chevrolet',  model: 'Trax' },
  CQRS: { make: 'Chevrolet',  model: 'Equinox' },
  CMBU: { make: 'Chevrolet',  model: 'Malibu' },
  CMLT: { make: 'Chevrolet',  model: 'Malibu LT' },
  CTAV: { make: 'Chevrolet',  model: 'Trailblazer' },

  // Tesla
  CTM3: { make: 'Tesla',      model: 'Model 3' },
  CM3L: { make: 'Tesla',      model: 'Model 3 Long Range' },

  // Hyundai
  CELA: { make: 'Hyundai',    model: 'Elantra' },
  CHVP: { make: 'Hyundai',    model: 'Venue' },
  CKOP: { make: 'Hyundai',    model: 'Kona' },
  CHPP: { make: 'Hyundai',    model: 'Palisade' },
  CTAP: { make: 'Hyundai',    model: 'Tucson' },

  // Mazda
  CC5S: { make: 'Mazda',      model: 'CX-5' },

  // Volkswagen
  CJCL: { make: 'Volkswagen', model: 'Jetta' },
  CTVA: { make: 'Volkswagen', model: 'Taos' },
  CATL: { make: 'Volkswagen', model: 'Atlas' },

  // Chrysler / Dodge
  CGCL: { make: 'Dodge',      model: 'Grand Caravan' },
  CPCL: { make: 'Chrysler',   model: 'Pacifica' },
  CDR8: { make: 'Dodge',      model: 'Durango' },
  C300: { make: 'Chrysler',   model: '300' },

  // Volvo
  CX96: { make: 'Volvo',      model: 'XC90' },
};

export function lookupCodex(code: string): CodexEntry | null {
  return YWG_VEHICLE_CODEX[code.toUpperCase()] ?? null;
}
