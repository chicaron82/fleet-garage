// The Hertz-fleet make/model/colour catalogue + shared field styling. Lives in its own
// (component-free) module so react-refresh is happy exporting it, and so BOTH the register
// form and the direct-edit modal share ONE source — a duplicated MAKES_MODELS map would drift
// the first time a new model is added.

/** make → models. The model <select> is driven off the chosen make; "Other" → "Other" is the
 *  escape hatch for anything off-catalogue. */
export const MAKES_MODELS: Record<string, string[]> = {
  Chevrolet:       ['Blazer', 'Colorado', 'Equinox', 'Malibu', 'Malibu LT', 'Silverado', 'Suburban', 'Tahoe', 'Trailblazer', 'Trax', 'Traverse'],
  Ford:            ['Bronco', 'Bronco Sport', 'Edge', 'Escape', 'Escape Hybrid', 'Expedition', 'Explorer', 'F-150', 'Maverick', 'Mustang'],
  Toyota:          ['4Runner', 'Camry', 'Camry Hybrid', 'Camry LE', 'Camry SE', 'Corolla', 'Corolla Cross', 'Corolla Hatchback', 'Corolla Hybrid', 'Highlander', 'Prius', 'RAV4', 'RAV4 Hybrid', 'Sienna', 'Tacoma'],
  Honda:           ['Accord', 'Civic', 'CR-V', 'HR-V', 'Pilot', 'Ridgeline'],
  Nissan:          ['Altima', 'Frontier', 'Kicks', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Versa'],
  Hyundai:         ['Elantra', 'Ioniq 5', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
  Kia:             ['Carnival', 'Forte', 'K4', 'K5', 'Niro', 'Niro EV', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Sportage Hybrid', 'Telluride'],
  Jeep:            ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Wrangler'],
  Dodge:           ['Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Ram 1500'],
  Chrysler:        ['300', 'Pacifica'],
  Buick:           ['Encore', 'Encore GX', 'Enclave', 'Envision', 'Envista'],
  GMC:             ['Acadia', 'Canyon', 'Sierra', 'Terrain', 'Yukon'],
  Cadillac:        ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6'],
  BMW:             ['2 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLC', 'GLE', 'GLS'],
  Audi:            ['A4', 'A6', 'Q3', 'Q5', 'Q7'],
  Mazda:           ['CX-30', 'CX-5'],
  Volkswagen:      ['Atlas', 'Jetta', 'Passat', 'Taos', 'Tiguan'],
  Volvo:           ['XC40', 'XC60', 'XC90'],
  Tesla:           ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Other:           ['Other'],
};

export const MAKES = Object.keys(MAKES_MODELS).sort();
export const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Brown', 'Gold', 'Other'];

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2030;

/** Shared input styling — the registration form imports this for its unit/plate fields too. */
export const INPUT = 'w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition bg-white dark:bg-gray-900 transition-colors';

export const FIELD_LABEL = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide';
