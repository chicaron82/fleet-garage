// ── Inventory Mock Data ────────────────────────────────────────────────────────

export type Zone = 'Standard' | 'Overflow' | 'Other';
export type InventoryClassification = 'Rentable' | 'Dirty';

export interface InventoryItem {
  id: string;
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  classification: InventoryClassification;
  zone: Zone;
  row?: string;           // Standard (Row 1–6) or Overflow (Row 7–12)
  locationText?: string;  // Other — free text
}

export interface InventorySnapshot {
  timestamp: string;
  takenBy: string;
  items: InventoryItem[];
}

export const MOCK_INVENTORY: InventorySnapshot = {
  timestamp: '2026-04-25T08:30:00',
  takenBy: 'Aaron S.',
  items: [
    // ── Standard — Row 1–6 (8 vehicles) ────────────────────────────────────
    { id: 'inv-1',  unitNumber: 'HRZ-6012', licensePlate: 'MBK 331', make: 'Toyota',     model: 'Corolla',  year: 2023, classification: 'Rentable', zone: 'Standard', row: 'Row 1' },
    { id: 'inv-2',  unitNumber: 'HRZ-7845', licensePlate: 'NPC 442', make: 'Nissan',      model: 'Sentra',   year: 2023, classification: 'Rentable', zone: 'Standard', row: 'Row 1' },
    { id: 'inv-3',  unitNumber: 'HRZ-3120', licensePlate: 'RXT 118', make: 'Chevrolet',   model: 'Cruze',    year: 2022, classification: 'Rentable', zone: 'Standard', row: 'Row 2' },
    { id: 'inv-4',  unitNumber: 'HRZ-2055', licensePlate: 'WPG 554', make: 'Hyundai',     model: 'Elantra',  year: 2024, classification: 'Rentable', zone: 'Standard', row: 'Row 3' },
    { id: 'inv-5',  unitNumber: 'HRZ-1199', licensePlate: 'TBK 219', make: 'Kia',         model: 'Forte',    year: 2023, classification: 'Rentable', zone: 'Standard', row: 'Row 4' },
    { id: 'inv-6',  unitNumber: 'HRZ-8830', licensePlate: 'QRS 610', make: 'Toyota',      model: 'Camry',    year: 2024, classification: 'Rentable', zone: 'Standard', row: 'Row 5' },
    { id: 'inv-7',  unitNumber: 'HRZ-4410', licensePlate: 'FGH 887', make: 'Ford',        model: 'Fusion',   year: 2022, classification: 'Rentable', zone: 'Standard', row: 'Row 5' },
    { id: 'inv-8',  unitNumber: 'HRZ-9981', licensePlate: 'JKL 720', make: 'Honda',       model: 'Civic',    year: 2023, classification: 'Rentable', zone: 'Standard', row: 'Row 6' },

    // ── Overflow — Row 7–12 (3 vehicles) ───────────────────────────────────
    { id: 'inv-9',  unitNumber: 'HRZ-5501', licensePlate: 'BND 993', make: 'Chevrolet',   model: 'Malibu',   year: 2022, classification: 'Rentable', zone: 'Overflow', row: 'Row 7' },
    { id: 'inv-10', unitNumber: 'HRZ-3340', licensePlate: 'DRT 441', make: 'Hyundai',     model: 'Tucson',   year: 2023, classification: 'Dirty',    zone: 'Overflow', row: 'Row 9' },
    { id: 'inv-11', unitNumber: 'HRZ-6650', licensePlate: 'PQR 882', make: 'Ford',        model: 'Escape',   year: 2022, classification: 'Dirty',    zone: 'Overflow', row: 'Row 11' },

    // ── Other — creative parking (2 vehicles) ───────────────────────────────
    { id: 'inv-12', unitNumber: 'HRZ-7720', licensePlate: 'KXP 105', make: 'Nissan',      model: 'Altima',   year: 2024, classification: 'Rentable', zone: 'Other', locationText: 'East fence' },
    { id: 'inv-13', unitNumber: 'HRZ-9920', licensePlate: 'SMK 201', make: 'Chevrolet',   model: 'Equinox',  year: 2023, classification: 'Dirty',    zone: 'Other', locationText: 'Next to detail bay door' },
  ],
};
