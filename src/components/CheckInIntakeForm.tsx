import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { CheckInHoldPanel } from './CheckInHoldPanel';
import { parseFleetBarcode } from '../lib/barcode';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image';
import type { Vehicle, ConditionRating, CheckInRouting, LostFoundLocation } from '../types';
import { deriveRouting } from '../types';

interface Props {
  onFlagIssue: (vehicleId: string) => void;
}

interface InlineFoundItem {
  id: string;
  description: string;
  location?: LostFoundLocation;
  additionalPhoto?: string;
}

const FOUND_LOCATIONS: { value: LostFoundLocation; label: string }[] = [
  { value: 'trunk',      label: 'Trunk' },
  { value: 'back_seat',  label: 'Back Seat' },
  { value: 'front_seat', label: 'Front' },
  { value: 'visor',      label: 'Visor' },
  { value: 'under_seat', label: 'Under Seat' },
  { value: 'other',      label: 'Other' },
];

const FUEL_LABELS: Record<number, string> = {
  0: 'Empty', 1: '1/8', 2: '1/4', 3: '3/8',
  4: '1/2',  5: '5/8', 6: '3/4', 7: '7/8', 8: 'Full',
};

function fuelColor(v: number): string {
  if (v <= 1) return '#ef4444';
  if (v <= 2) return '#f97316';
  if (v <= 3) return '#eab308';
  return '#22c55e';
}

const CONDITION_RATINGS: ConditionRating[] = ['clean', 'good', 'questionable', 'escalated'];

const CONDITION_CONFIG: Record<ConditionRating, { label: string; activeClass: string }> = {
  clean:        { label: 'Clean',        activeClass: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  good:         { label: 'Good',         activeClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
  questionable: { label: 'Questionable', activeClass: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
  escalated:    { label: 'Escalated',    activeClass: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
};

const ROUTING_CONFIG: Record<CheckInRouting, {
  icon: string; label: string; description: string;
  className: string; textClass: string;
}> = {
  flip: {
    icon: '✅',
    label: 'Flip Eligible',
    description: 'Interior and exterior both clean. Vehicle can be flipped at the booth.',
    className: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40',
    textClass: 'text-green-700 dark:text-green-400',
  },
  washbay: {
    icon: '🚿',
    label: 'Send to Washbay',
    description: 'Vehicle needs standard cleaning before returning to fleet.',
    className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  review: {
    icon: '🔍',
    label: 'Needs Review',
    description: 'Condition is questionable. Hold at HIR for second opinion.',
    className: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  escalated: {
    icon: '🚨',
    label: 'Escalated',
    description: 'Definite issue found. Flag for management review.',
    className: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
    textClass: 'text-red-700 dark:text-red-400',
  },
};

export function CheckInIntakeForm({ onFlagIssue }: Props) {
  const { user } = useAuth();
  const { vehicles, getVehicleByUnit, getHoldsForVehicle, addHold, addLostFoundItem } = useGarage();

  const [scanned, setScanned]                   = useState<{ vehicle: Vehicle; timestamp: string } | null>(null);
  const [unitSearch, setUnitSearch]             = useState('');
  const [mileage, setMileage]                   = useState('');
  const [fuelLevel, setFuelLevel]               = useState<number | null>(null);
  const [photoCount, setPhotoCount]             = useState(0);
  const [interiorCondition, setInteriorCondition] = useState<ConditionRating | null>(null);
  const [exteriorCondition, setExteriorCondition] = useState<ConditionRating | null>(null);
  const [conditionNotes, setConditionNotes]     = useState('');
  const [submitted, setSubmitted]               = useState(false);
  const [reHolded, setReHolded]                 = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [saveError, setSaveError]               = useState(false);
  const [toast, setToast]                       = useState<string | null>(null);
  const [showFoundSection, setShowFoundSection] = useState(false);
  const [foundItems, setFoundItems]             = useState<InlineFoundItem[]>([]);
  const [loggedCount, setLoggedCount]           = useState(0);

  const routing = useMemo<CheckInRouting | null>(() => {
    if (!interiorCondition || !exteriorCondition) return null;
    return deriveRouting(interiorCondition, exteriorCondition);
  }, [interiorCondition, exteriorCondition]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDecode = useCallback((raw: string, timestamp: string) => {
    const result = parseFleetBarcode(raw);
    if (!result.ok) {
      showToast('Unrecognized barcode — enter unit number manually');
      return;
    }
    const vehicle = getVehicleByUnit(result.unit);
    if (!vehicle) {
      showToast(`Unit ${result.unit} not in system`);
      return;
    }
    setScanned({ vehicle, timestamp });
    setMileage('');
    setFuelLevel(null);
    setPhotoCount(0);
    setInteriorCondition(null);
    setExteriorCondition(null);
    setConditionNotes('');
    setSubmitted(false);
    setReHolded(false);
    setSaveError(false);
  }, [getVehicleByUnit, showToast]);

  const handleSubmit = async () => {
    if (!user || !scanned || !interiorCondition || !exteriorCondition) return;
    hapticMedium();
    setSubmitting(true);
    setSaveError(false);

    const derivedRouting = deriveRouting(interiorCondition, exteriorCondition);

    const { error } = await supabase.from('vehicle_checkins').insert({
      branch_id:          user.branchId,
      vehicle_id:         scanned.vehicle.id,
      vehicle_unit:       scanned.vehicle.unitNumber,
      vehicle_plate:      scanned.vehicle.licensePlate,
      checked_in_by_id:   user.id,
      checked_in_by_name: user.name,
      mileage:            mileage ? Number(mileage) : null,
      fuel_level:         fuelLevel,
      photo_count:        photoCount,
      interior_condition: interiorCondition,
      exterior_condition: exteriorCondition,
      routing:            derivedRouting,
      condition_notes:    conditionNotes.trim() || null,
    });

    setSubmitting(false);
    if (error) { setSaveError(true); return; }

    const validItems = foundItems.filter(i => i.description.trim());
    if (validItems.length > 0) {
      await Promise.all(validItems.map(item => addLostFoundItem({
        description:  item.description.trim(),
        location:     item.location,
        itemPhoto:    item.additionalPhoto,
        licensePlate: scanned.vehicle.licensePlate,
        unitNumber:   scanned.vehicle.unitNumber,
      })));
      setLoggedCount(validItems.length);
    }

    setSubmitted(true);
  };

  const handleReset = () => {
    setScanned(null);
    setSubmitted(false);
    setReHolded(false);
    setSaveError(false);
    setInteriorCondition(null);
    setExteriorCondition(null);
    setConditionNotes('');
    setShowFoundSection(false);
    setFoundItems([]);
    setLoggedCount(0);
  };

  const handleReHold = useCallback(async (
    vehicleId: string,
    description: string,
    notes: string,
    photos: string[],
    linkedHoldId: string,
  ) => {
    if (!user) return;
    await addHold(vehicleId, description, notes, user.id, photos, ['damage'], undefined, undefined, linkedHoldId);
    setReHolded(true);
  }, [user, addHold]);

  const addFoundItem = () => {
    setFoundItems(prev => [...prev, { id: crypto.randomUUID(), description: '', location: undefined, additionalPhoto: undefined }]);
  };

  const removeFoundItem = (id: string) => {
    setFoundItems(prev => {
      const next = prev.filter(i => i.id !== id);
      if (next.length === 0) setShowFoundSection(false);
      return next;
    });
  };

  const updateFoundItem = (id: string, patch: Partial<InlineFoundItem>) => {
    setFoundItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const canSubmit = !!interiorCondition && !!exteriorCondition && !submitting && scanned?.vehicle.status !== 'HELD';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Vehicle Intake
        </p>
        {scanned && !submitted && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">
            Clear
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!scanned && (
          <div className="py-2">
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                Scan the vehicle barcode to begin intake
              </p>
              <CameraBarcodeScanner onDecode={handleDecode} label="Scan to Check In" />
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter unit # or plate…"
                  value={unitSearch}
                  onChange={e => setUnitSearch(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
                />
                {unitSearch && (
                  <button
                    onClick={() => setUnitSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none cursor-pointer"
                    aria-label="Clear search"
                  >×</button>
                )}
              </div>
              {unitSearch.trim().length >= 2 && (
                <div className="space-y-1">
                  {(() => {
                    const results = vehicles.filter(v =>
                      v.unitNumber.toUpperCase().includes(unitSearch.trim().toUpperCase()) ||
                      v.licensePlate.toUpperCase().includes(unitSearch.trim().toUpperCase())
                    ).slice(0, 5);
                    if (results.length === 0) {
                      return (
                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 transition-colors rounded-lg border border-gray-200 dark:border-gray-800">
                          <p className="text-xs text-gray-500 dark:text-gray-400">"{unitSearch}" not in the system.</p>
                        </div>
                      );
                    }
                    return results.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setScanned({ vehicle: v, timestamp: new Date().toISOString() });
                          setUnitSearch('');
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-yellow-400 hover:bg-yellow-50 transition text-sm cursor-pointer"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{v.unitNumber}</span>
                        <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{v.licensePlate}</span>
                        <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
                      </button>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {scanned && !submitted && (
          <>
            {scanned.vehicle.status === 'HELD' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/50 rounded-lg px-4 py-3">
                <p className="font-semibold text-sm text-red-800 dark:text-red-300">⚠ Vehicle is currently on hold</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Check-in cannot be submitted while an active hold is open.</p>
              </div>
            )}

            {(scanned.vehicle.status === 'OUT_ON_EXCEPTION' || scanned.vehicle.status === 'PRE_EXISTING') && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg px-4 py-3">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">⚠ On-exception return</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  This vehicle was released with known damage. Inspect the flagged area before completing check-in.
                </p>
              </div>
            )}

            {/* Vehicle card */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3 space-y-1 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{scanned.vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model} · {scanned.vehicle.color}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Plate: {scanned.vehicle.licensePlate}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  Scanned<br />{fmtTime(scanned.timestamp)}
                </span>
              </div>
              {user && (
                <CheckInHoldPanel
                  vehicle={scanned.vehicle}
                  holds={getHoldsForVehicle(scanned.vehicle.id)}
                  user={user}
                  onReHold={handleReHold}
                  autoExpand={
                    scanned.vehicle.status === 'OUT_ON_EXCEPTION' ||
                    scanned.vehicle.status === 'PRE_EXISTING'
                  }
                />
              )}
            </div>

            {/* Mileage + Fuel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Mileage (km)</label>
                <input
                  type="number"
                  placeholder="e.g. 42800"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Fuel Level</label>
                <div className="space-y-2 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: fuelLevel !== null ? fuelColor(fuelLevel) : '#9ca3af' }}>
                      ⛽ {fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '—'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                      {fuelLevel !== null ? `${fuelLevel}/8` : 'set level'}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={8} step={1}
                    value={fuelLevel ?? 4}
                    onChange={e => setFuelLevel(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 transition-colors"
                    style={{ accentColor: fuelLevel !== null ? fuelColor(fuelLevel) : '#9ca3af' }}
                  />
                  <div className="flex justify-between px-0.5">
                    {Array.from({ length: 9 }, (_, i) => (
                      <div key={i} className={`w-px h-1.5 rounded-full transition-colors ${fuelLevel !== null && i <= fuelLevel ? 'bg-gray-400 dark:bg-gray-400' : 'bg-gray-300 dark:bg-gray-700'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                    <span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Photos */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Photos</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoCount(p => Math.min(p + 1, 6))}
                  className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5"
                >
                  <span className="text-xl leading-none">+</span>
                  <span className="text-xs leading-none">Photo</span>
                </button>
                {Array.from({ length: photoCount }).map((_, i) => (
                  <div key={i} className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors">
                    <span className="text-xl">📷</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Condition ratings */}
            <div className="space-y-4">
              {(['interior', 'exterior'] as const).map(side => {
                const value = side === 'interior' ? interiorCondition : exteriorCondition;
                const setter = side === 'interior' ? setInteriorCondition : setExteriorCondition;
                return (
                  <div key={side}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                      {side === 'interior' ? 'Interior' : 'Exterior'} Condition *
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {CONDITION_RATINGS.map(rating => {
                        const cfg = CONDITION_CONFIG[rating];
                        const active = value === rating;
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => { hapticLight(); setter(r => r === rating ? null : rating); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                              active
                                ? cfg.activeClass
                                : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Condition notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Condition Notes</label>
                <textarea
                  rows={2}
                  placeholder="Rear seat looks stained, possible food spill…"
                  value={conditionNotes}
                  onChange={e => setConditionNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition resize-none"
                />
              </div>

              {/* Routing preview */}
              {routing && (() => {
                const cfg = ROUTING_CONFIG[routing];
                return (
                  <div className={`rounded-lg border px-4 py-3 transition-colors ${cfg.className}`}>
                    <p className={`text-sm font-semibold ${cfg.textClass}`}>
                      {cfg.icon} {cfg.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${cfg.textClass} opacity-80`}>{cfg.description}</p>
                  </div>
                );
              })()}
            </div>

            {/* Items Found */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              {!showFoundSection ? (
                <button
                  type="button"
                  onClick={() => { setShowFoundSection(true); addFoundItem(); }}
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                >
                  + Log Found Item
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Items Found</p>
                  {foundItems.map((item, idx) => (
                    <div key={item.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 space-y-2.5 border border-gray-200 dark:border-gray-800 transition-colors">
                      {foundItems.length > 1 && (
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Item {idx + 1}</p>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Description *</label>
                        <input
                          type="text"
                          placeholder="Wooden rod, jacket, luggage…"
                          value={item.description}
                          onChange={e => updateFoundItem(item.id, { description: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Location</label>
                        <div className="flex flex-wrap gap-1.5">
                          {FOUND_LOCATIONS.map(loc => (
                            <button
                              key={loc.value}
                              type="button"
                              onClick={() => updateFoundItem(item.id, { location: item.location === loc.value ? undefined : loc.value })}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                                item.location === loc.value
                                  ? 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              {loc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Photo (optional)</label>
                        {item.additionalPhoto ? (
                          <div className="flex items-center gap-2">
                            <img src={item.additionalPhoto} alt="Found item" className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />
                            <button
                              type="button"
                              onClick={() => updateFoundItem(item.id, { additionalPhoto: undefined })}
                              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                            >
                              Remove photo
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer">
                            📷 Add photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const compressed = await compressImage(file);
                                updateFoundItem(item.id, { additionalPhoto: compressed });
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFoundItem(item.id)}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFoundItem}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                  >
                    + Add another item
                  </button>
                </div>
              )}
            </div>

            {saveError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3 transition-colors">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                {submitting ? 'Saving…' : '✓ Submit Check-in'}
              </button>
              <button
                type="button"
                disabled={reHolded}
                onClick={() => onFlagIssue(scanned.vehicle.id)}
                className="px-4 py-2.5 border-2 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Flag Issue
              </button>
            </div>
          </>
        )}

        {submitted && scanned && routing && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">{ROUTING_CONFIG[routing].icon}</span>
            <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
              {scanned.vehicle.unitNumber} checked in
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              {ROUTING_CONFIG[routing].label}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model}
              {fuelLevel !== null ? ` · Fuel: ${FUEL_LABELS[fuelLevel]}` : ''}
              {mileage ? ` · ${Number(mileage).toLocaleString()} km` : ''}
            </p>
            {loggedCount > 0 && (
              <div className="px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 rounded-lg text-xs text-teal-700 dark:text-teal-400 font-semibold">
                📦 {loggedCount} item{loggedCount > 1 ? 's' : ''} logged to Lost &amp; Found
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer"
            >
              Check in another →
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: '1.5rem', left: '50%',
            transform: 'translateX(-50%)', zIndex: 50,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(153, 27, 27, 0.85)', color: 'white',
            padding: '0.75rem 1.25rem', borderRadius: '0.75rem',
            fontSize: '0.875rem', fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' as const,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
