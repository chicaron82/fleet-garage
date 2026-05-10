export interface YWGVehicleEntry {
  unit: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  rentalClass: string;
  owningBranch: string;
}

export const YWG_VEHICLE_CLASSES: YWGVehicleEntry[] = [
  { unit: '5514229', plate: 'LJF674',  make: 'Tesla',      model: 'Model 3 Long Range', year: 2022, color: 'Black',  rentalClass: 'E8', owningBranch: 'VAN DTG 08890'   },
  { unit: '3163318', plate: 'XF217E',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Black',  rentalClass: 'B5', owningBranch: 'VANCOUVER 08191'  },
  { unit: '5420971', plate: 'LFJ304',  make: 'Hyundai',    model: 'Elantra',            year: 2025, color: 'Blue',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5422118', plate: 'LUR266',  make: 'Toyota',     model: 'Camry Hybrid',       year: 2025, color: 'White',  rentalClass: 'E6', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5421656', plate: 'LUR143',  make: 'Nissan',     model: 'Kicks',              year: 2025, color: 'White',  rentalClass: 'Q4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5332879', plate: 'DFDA732', make: 'Nissan',     model: 'Versa',              year: 2025, color: 'Blue',   rentalClass: 'B',  owningBranch: 'TORONTO 08197'    },
  { unit: '5420690', plate: 'LFJ351',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'White',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5422712', plate: 'LUR316',  make: 'Toyota',     model: 'Corolla',            year: 2026, color: 'Gray',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5424452', plate: 'LUR193',  make: 'Hyundai',    model: 'Elantra',            year: 2025, color: 'White',  rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5421664', plate: 'LUR148',  make: 'Mazda',      model: 'CX-5',               year: 2025, color: 'Blue',   rentalClass: 'Q4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5420401', plate: 'LFJ370',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Black',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5424395', plate: 'LUR191',  make: 'Volkswagen', model: 'Jetta',              year: 2025, color: 'Gray',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5777685', plate: '0ET191',  make: 'Volkswagen', model: 'Jetta',              year: 2025, color: 'Silver', rentalClass: 'C',  owningBranch: 'CALGARY 08193'    },
  { unit: '5421748', plate: 'LUR126',  make: 'Ford',       model: 'Explorer',           year: 2026, color: 'White',  rentalClass: 'L2', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5421615', plate: 'LUR142',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Blue',   rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5732904', plate: '0DE193',  make: 'Hyundai',    model: 'Elantra',            year: 2025, color: 'White',  rentalClass: 'C',  owningBranch: 'CALGARY 08193'    },
  { unit: '5422100', plate: 'LUR265',  make: 'Toyota',     model: 'Corolla Hybrid',     year: 2025, color: 'Gray',   rentalClass: 'E6', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5429139', plate: 'LUR458',  make: 'Chevrolet',  model: 'Trax',               year: 2026, color: 'Black',  rentalClass: 'B4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5424924', plate: 'LUR245',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Gray',   rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5420393', plate: 'LFJ371',  make: 'Nissan',     model: 'Rogue',              year: 2025, color: 'Black',  rentalClass: 'Q4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5429022', plate: 'LUR430',  make: 'Volvo',      model: 'XC90',               year: 2026, color: 'Gray',   rentalClass: 'Z4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5422951', plate: 'LUR276',  make: 'Nissan',     model: 'Versa',              year: 2025, color: 'Black',  rentalClass: 'B',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5426440', plate: 'LUR378',  make: 'Toyota',     model: 'Corolla',            year: 2026, color: 'Gray',   rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '3161031', plate: 'XE894V',  make: 'Toyota',     model: 'Corolla Hatchback',  year: 2025, color: 'Gray',   rentalClass: 'B',  owningBranch: 'VANCOUVER 08191'  },
  { unit: '5424510', plate: 'LUR204',  make: 'Ford',       model: 'Escape',             year: 2025, color: 'Gray',   rentalClass: 'Q4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5424148', plate: 'LUR165',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Black',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5422472', plate: 'LUR358',  make: 'Kia',        model: 'Kicks 2026',         year: 2026, color: 'White',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5426838', plate: 'LUR429',  make: 'Ford',       model: 'Explorer',           year: 2026, color: 'White',  rentalClass: 'L2', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5276233', plate: 'DEEL822', make: 'Hyundai',    model: 'Venue',              year: 2025, color: 'Gray',   rentalClass: 'B4', owningBranch: 'TORONTO 08197'    },
  { unit: '5753827', plate: '0ES679',  make: 'Toyota',     model: 'Corolla Hybrid',     year: 2025, color: 'White',  rentalClass: 'E6', owningBranch: 'CALGARY 08193'    },
  { unit: '2148476', plate: '261PDU',  make: 'Toyota',     model: 'Corolla Hybrid',     year: 2026, color: 'White',  rentalClass: 'E6', owningBranch: 'SASK 08190'       },
  { unit: '5420229', plate: 'LFJ331',  make: 'Nissan',     model: 'Sentra',             year: 2025, color: 'Black',  rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5422928', plate: 'LUR278',  make: 'Volkswagen', model: 'Jetta',              year: 2025, color: 'Gray',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5429964', plate: 'LUR444',  make: 'Unknown',    model: 'CTAV',               year: 2026, color: 'Gray',   rentalClass: 'B4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5429766', plate: 'LUR474',  make: 'Hyundai',    model: 'Venue',              year: 2026, color: 'White',  rentalClass: 'B4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5426879', plate: 'LUR395',  make: 'Kia',        model: 'Seltos',             year: 2026, color: 'Black',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5420757', plate: 'LFJ346',  make: 'Hyundai',    model: 'Venue',              year: 2025, color: 'Gray',   rentalClass: 'B4', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5420922', plate: 'LFJ306',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'Plum',   rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5420310', plate: 'LFJ354',  make: 'Kia',        model: 'Seltos',             year: 2025, color: 'White',  rentalClass: 'B5', owningBranch: 'WINNIPEG 08199'   },
  { unit: '5429733', plate: 'LUR471',  make: 'Toyota',     model: 'Corolla',            year: 2026, color: 'Blue',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5426861', plate: 'LUR396',  make: 'Toyota',     model: 'Corolla',            year: 2026, color: 'Gray',   rentalClass: 'C',  owningBranch: 'WINNIPEG 08199'   },
  { unit: '5759733', plate: '0FB042',  make: 'Toyota',     model: 'Corolla Hybrid',     year: 2025, color: 'Gray',   rentalClass: 'E6', owningBranch: 'CALGARY 08193'    },
];

export function getClassByPlate(plate: string): string | null {
  const entry = YWG_VEHICLE_CLASSES.find(v => v.plate.toUpperCase() === plate.toUpperCase());
  return entry?.rentalClass ?? null;
}

export function getExampleVehicleByClass(cls: string, branchHint = 'WINNIPEG'): YWGVehicleEntry | null {
  return YWG_VEHICLE_CLASSES.find(v =>
    v.rentalClass === cls && v.owningBranch.includes(branchHint)
  ) ?? null;
}
