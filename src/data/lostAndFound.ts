// ── Lost & Found Mock Data ────────────────────────────────────────────────────

export interface LostFoundItem {
  id: string;
  vehicleUnit: string;
  itemDescription: string;
  foundBy: string;
  foundAt: string;
  storageLocation: string;
}

export const MOCK_LOST_FOUND: LostFoundItem[] = [
  {
    id: 'lf-1',
    vehicleUnit: 'HRZ-4821',
    itemDescription: 'Phone charger (USB-C, white, Apple-style)',
    foundBy: 'Aaron S.',
    foundAt: '2026-04-12T15:20:00',
    storageLocation: 'Front desk bin #2',
  },
  {
    id: 'lf-2',
    vehicleUnit: 'HRZ-3307',
    itemDescription: 'Sunglasses — dark tortoiseshell, Ray-Ban style',
    foundBy: 'DiZee',
    foundAt: '2026-04-10T11:45:00',
    storageLocation: 'Front desk bin #1',
  },
  {
    id: 'lf-3',
    vehicleUnit: 'HRZ-5590',
    itemDescription: 'Navy zip-up jacket, size M, no brand tag',
    foundBy: 'Belle',
    foundAt: '2026-04-08T09:10:00',
    storageLocation: 'Lost & found shelf',
  },
  {
    id: 'lf-4',
    vehicleUnit: 'HRZ-9981',
    itemDescription: 'Water bottle — Hydro Flask, green, 32oz',
    foundBy: 'CoZee',
    foundAt: '2026-04-07T14:30:00',
    storageLocation: 'Lost & found shelf',
  },
  {
    id: 'lf-5',
    vehicleUnit: 'HRZ-7845',
    itemDescription: 'Child\'s stuffed animal — brown teddy bear, ~12 inches',
    foundBy: 'GenZee',
    foundAt: '2026-04-13T08:15:00',
    storageLocation: 'Front desk bin #3',
  },
];
