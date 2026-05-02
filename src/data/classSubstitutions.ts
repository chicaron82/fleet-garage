import type { RentalClass } from './manifest';

export interface ClassInfo {
  code: RentalClass;
  label: string;
  example: string;
  tier: ClassTier;
  acceptable: RentalClass[];
  upgradeOk: RentalClass[];
  stretch: RentalClass[];
  never: string;
}

export type ClassTier =
  | 'sedan'
  | 'suv'
  | 'hybrid-ev'
  | 'minivan'
  | 'truck'
  | 'managers-special';

export const CLASS_INFO: Record<RentalClass, ClassInfo> = {
  A:  { code: 'A',  label: 'Economy',          example: 'Kia Rio',               tier: 'sedan',            acceptable: [],             upgradeOk: ['B','C','D','F'],  stretch: [],            never: 'SUV, Specialty' },
  B:  { code: 'B',  label: 'Compact',           example: 'Nissan Versa',          tier: 'sedan',            acceptable: ['A'],          upgradeOk: ['C','D','F'],      stretch: ['A'],         never: 'SUV, Specialty' },
  C:  { code: 'C',  label: 'Midsize',           example: 'Hyundai Elantra',       tier: 'sedan',            acceptable: ['D'],          upgradeOk: ['D','F'],          stretch: ['B'],         never: 'SUV, Specialty' },
  D:  { code: 'D',  label: 'Regular',           example: 'Volkswagen Jetta',      tier: 'sedan',            acceptable: ['C','F'],      upgradeOk: ['F'],              stretch: ['C'],         never: 'SUV, Specialty' },
  F:  { code: 'F',  label: 'Fullsize',          example: 'Toyota Camry',          tier: 'sedan',            acceptable: ['D'],          upgradeOk: [],                 stretch: ['C'],         never: 'SUV, Specialty' },
  B5: { code: 'B5', label: 'Compact SUV',       example: 'Kia Seltos',            tier: 'suv',              acceptable: [],             upgradeOk: ['Q4','L'],         stretch: [],            never: 'Sedan, EV, Minivan, Truck' },
  B4: { code: 'B4', label: 'Small Crossover',   example: 'Nissan Kicks',          tier: 'suv',              acceptable: [],             upgradeOk: ['B5','Q4'],        stretch: [],            never: 'Sedan, EV, Minivan, Truck' },
  Q4: { code: 'Q4', label: 'Small SUV AWD',     example: 'Nissan Rogue',          tier: 'suv',              acceptable: ['B5'],         upgradeOk: ['L','L2','T'],     stretch: ['B5'],        never: 'Sedan, EV, Minivan, Truck' },
  L:  { code: 'L',  label: 'Regular SUV',       example: 'Ford Edge',             tier: 'suv',              acceptable: ['Q4','L2'],    upgradeOk: ['L2','T','T4'],    stretch: ['Q4'],        never: 'Sedan, EV, Minivan, Truck' },
  L2: { code: 'L2', label: 'SUV 7-seater',      example: 'Ford Explorer',         tier: 'suv',              acceptable: ['T'],          upgradeOk: ['T','T4','T6'],    stretch: ['L'],         never: 'Sedan, Compact SUV, EV' },
  T:  { code: 'T',  label: 'Large SUV',         example: 'Dodge Durango',         tier: 'suv',              acceptable: ['T4','L2'],    upgradeOk: ['T4','T6'],        stretch: ['L'],         never: 'Sedan, EV, Minivan, Truck' },
  T4: { code: 'T4', label: 'Large SUV',         example: 'Palisade',              tier: 'suv',              acceptable: ['T','T6'],     upgradeOk: ['T6'],             stretch: ['L2'],        never: 'Sedan, EV, Minivan, Truck' },
  T6: { code: 'T6', label: 'Largest SUV',       example: 'Volvo XC90',            tier: 'suv',              acceptable: ['T4','T'],     upgradeOk: [],                 stretch: ['L2'],        never: 'Sedan, Compact, EV' },
  E6: { code: 'E6', label: 'Hybrid',            example: 'Toyota Prius',          tier: 'hybrid-ev',        acceptable: ['E1'],         upgradeOk: ['E7','E8','E9'],   stretch: [],            never: 'Gas sedan, SUV' },
  E1: { code: 'E1', label: 'EV (Non-Tesla)',    example: 'Kia Niro EV',           tier: 'hybrid-ev',        acceptable: ['E6'],         upgradeOk: ['E7','E8','E9'],   stretch: [],            never: 'Gas sedan, SUV' },
  E7: { code: 'E7', label: 'Electric',          example: 'Tesla Model 3 SR',      tier: 'hybrid-ev',        acceptable: ['E8','E9'],    upgradeOk: ['E8','E9'],        stretch: ['E6'],        never: 'Gas sedan, SUV' },
  E8: { code: 'E8', label: 'Tesla Dual Motor',  example: 'Tesla Model 3 AWD',     tier: 'hybrid-ev',        acceptable: ['E7','E9'],    upgradeOk: ['E9'],             stretch: ['E6'],        never: 'Gas sedan, SUV' },
  E9: { code: 'E9', label: 'Tesla Model Y',     example: 'Tesla Model Y',         tier: 'hybrid-ev',        acceptable: ['E8'],         upgradeOk: [],                 stretch: ['E7','E6'],   never: 'Gas sedan, SUV' },
  R:  { code: 'R',  label: 'Minivan',           example: 'Chrysler Grand Caravan', tier: 'minivan',          acceptable: ['L2', 'T'],    upgradeOk: ['T4'],             stretch: ['T6'],        never: 'Sedan, Compact, EV — customer needs passenger space' },
  O6: { code: 'O6', label: 'Mid-Size Truck',      example: 'Nissan Frontier',       tier: 'truck',            acceptable: ['S'],          upgradeOk: ['T', 'T4'],        stretch: ['R'],         never: 'Sedan, Compact, EV, Hybrid — customer needs hauling space' },
  S:  { code: 'S',  label: 'Pickup Truck',       example: 'Ford F-150',            tier: 'truck',            acceptable: ['T', 'T4'],    upgradeOk: ['T6'],             stretch: ['R'],         never: 'Sedan, Compact, EV, Hybrid — customer needs hauling space' },
  A6: { code: 'A6', label: "Manager's Special", example: 'Counter discretion',    tier: 'managers-special', acceptable: [],             upgradeOk: [],                 stretch: [],            never: 'Counter discretion only — not VSA territory' },
};
