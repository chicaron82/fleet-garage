// ── Closing Inventory Mock Data ───────────────────────────────────────────────

export type InventoryClassification = 'Rentable' | 'Dirty' | 'Damage Hold' | 'Detail Hold';

export interface InventoryItem {
  id: string;
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  classification: InventoryClassification;
  lotLocation: string;
}

export interface InventorySnapshot {
  timestamp: string;
  takenBy: string;
  items: InventoryItem[];
}

export const MOCK_INVENTORY: InventorySnapshot = {
  timestamp: '2026-04-13T18:30:00',
  takenBy: 'Aaron S.',
  items: [
    // Rentable (10)
    { id: 'inv-1',  unitNumber: 'HRZ-6012', licensePlate: 'MBK 331', make: 'Toyota',     model: 'Corolla',   year: 2023, classification: 'Rentable', lotLocation: 'Row A-1' },
    { id: 'inv-2',  unitNumber: 'HRZ-7845', licensePlate: 'NPC 442', make: 'Nissan',      model: 'Sentra',    year: 2023, classification: 'Rentable', lotLocation: 'Row A-2' },
    { id: 'inv-3',  unitNumber: 'HRZ-3120', licensePlate: 'RXT 118', make: 'Chevrolet',   model: 'Cruze',     year: 2022, classification: 'Rentable', lotLocation: 'Row A-3' },
    { id: 'inv-4',  unitNumber: 'HRZ-2055', licensePlate: 'WPG 554', make: 'Hyundai',     model: 'Elantra',   year: 2024, classification: 'Rentable', lotLocation: 'Row A-4' },
    { id: 'inv-5',  unitNumber: 'HRZ-1199', licensePlate: 'TBK 219', make: 'Kia',         model: 'Forte',     year: 2023, classification: 'Rentable', lotLocation: 'Row A-5' },
    { id: 'inv-6',  unitNumber: 'HRZ-8830', licensePlate: 'QRS 610', make: 'Toyota',      model: 'Camry',     year: 2024, classification: 'Rentable', lotLocation: 'Row B-1' },
    { id: 'inv-7',  unitNumber: 'HRZ-4410', licensePlate: 'FGH 887', make: 'Ford',        model: 'Fusion',    year: 2022, classification: 'Rentable', lotLocation: 'Row B-2' },
    { id: 'inv-8',  unitNumber: 'HRZ-9981', licensePlate: 'JKL 720', make: 'Honda',       model: 'Civic',     year: 2023, classification: 'Rentable', lotLocation: 'Row B-3' },
    { id: 'inv-9',  unitNumber: 'HRZ-5501', licensePlate: 'BND 993', make: 'Chevrolet',   model: 'Malibu',    year: 2022, classification: 'Rentable', lotLocation: 'Row B-4' },
    { id: 'inv-10', unitNumber: 'HRZ-7720', licensePlate: 'KXP 105', make: 'Nissan',      model: 'Altima',    year: 2024, classification: 'Rentable', lotLocation: 'Row B-5' },

    // Dirty (3)
    { id: 'inv-11', unitNumber: 'HRZ-3340', licensePlate: 'DRT 441', make: 'Hyundai',     model: 'Tucson',    year: 2023, classification: 'Dirty', lotLocation: 'Wash Queue' },
    { id: 'inv-12', unitNumber: 'HRZ-6650', licensePlate: 'PQR 882', make: 'Ford',        model: 'Escape',    year: 2022, classification: 'Dirty', lotLocation: 'Wash Queue' },
    { id: 'inv-13', unitNumber: 'HRZ-1180', licensePlate: 'VWX 337', make: 'Toyota',      model: 'RAV4',      year: 2024, classification: 'Dirty', lotLocation: 'Wash Queue' },

    // Damage Hold (3) — overlap with real Fleet Garage vehicles
    { id: 'inv-14', unitNumber: 'HRZ-4821', licensePlate: 'GHK 294', make: 'Toyota',      model: 'Camry',     year: 2022, classification: 'Damage Hold', lotLocation: 'Hold Bay' },
    { id: 'inv-15', unitNumber: 'HRZ-2298', licensePlate: 'PBX 773', make: 'Hyundai',     model: 'Elantra',   year: 2022, classification: 'Damage Hold', lotLocation: 'Hold Bay' },
    { id: 'inv-16', unitNumber: '5513130',  licensePlate: 'LJF684',  make: 'Tesla',       model: 'Model Y',   year: 2022, classification: 'Damage Hold', lotLocation: 'Hold Bay' },

    // Detail Hold (2)
    { id: 'inv-17', unitNumber: 'HRZ-9920', licensePlate: 'SMK 201', make: 'Chevrolet',   model: 'Equinox',   year: 2023, classification: 'Detail Hold', lotLocation: 'Detail Bay' },
    { id: 'inv-18', unitNumber: 'HRZ-5577', licensePlate: 'PHR 660', make: 'Kia',         model: 'Sportage',  year: 2024, classification: 'Detail Hold', lotLocation: 'Detail Bay' },
  ],
};
