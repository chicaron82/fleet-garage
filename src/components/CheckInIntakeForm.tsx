import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { CheckInHoldPanel } from './CheckInHoldPanel';
import { EVAssetCheck } from './EVAssetCheck';
import type { EvLastCheck } from './EVAssetCheck';
import { VehicleScanAndMatch } from './VehicleScanAndMatch';
import { LostFoundItemList, type InlineFoundItem } from './LostFoundItemList';
import { parseFleetBarcode } from '../lib/barcode';
import { hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { isTesla } from '../lib/vehicles';
import { createOrEnrichRegistry } from '../lib/vehicleRegistry';
import type { Vehicle, ConditionRating, CheckInRouting, EvAssetStatus, HoldType } from '../types';
import { deriveRouting } from '../types';
import { ConditionRatingsSelector } from './ConditionRatingsSelector';
import { FuelLevelSelector, FUEL_LABELS } from './FuelLevelSelector';
import { CheckInRoutingPreview, ROUTING_CONFIG } from './CheckInRoutingPreview';
import { Toast } from './Toast';
interface Props {
  onFlagIssue: (vehicleId: string) => void;
}

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

  const [evCableStatus, setEvCableStatus]       = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus]   = useState<EvAssetStatus | null>(null);
  const [lastEvCheck, setLastEvCheck]           = useState<EvLastCheck | null>(null);
  const [lastMileage, setLastMileage]           = useState<number | null>(null);

  const fetchLastMileage = useCallback(async (vehicle: Vehicle) => {
    const { data } = await supabase
      .from('vehicle_checkins')
      .select('mileage')
      .eq('vehicle_id', vehicle.id)
      .not('mileage', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && data.mileage) {
      setLastMileage(Number(data.mileage));
    } else {
      setLastMileage(null);
    }
  }, []);

  const routing = useMemo<CheckInRouting | null>(() => {
    if (!interiorCondition || !exteriorCondition) return null;
    return deriveRouting(interiorCondition, exteriorCondition);
  }, [interiorCondition, exteriorCondition]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchEvLastCheck = useCallback(async (vehicle: Vehicle) => {
    const unit = vehicle.unitNumber;
    const [{ data: trip }, { data: checkin }] = await Promise.all([
      supabase.from('vsa_trips')
        .select('ev_cable_status, ev_adapter_status, depart_time, driver_id')
        .eq('vehicle_unit', unit)
        .not('ev_cable_status', 'is', null)
        .order('depart_time', { ascending: false })
        .limit(1).maybeSingle(),
      supabase.from('vehicle_checkins')
        .select('ev_cable_status, ev_adapter_status, created_at, checked_in_by_name')
        .eq('vehicle_id', vehicle.id)
        .not('ev_cable_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle(),
    ]);
    const candidates: EvLastCheck[] = [];
    if (trip) {
      const r = trip as Record<string, unknown>;
      candidates.push({
        cableStatus:   (r.ev_cable_status as EvAssetStatus) ?? null,
        adapterStatus: (r.ev_adapter_status as EvAssetStatus) ?? null,
        when:          r.depart_time as string,
        byName:        (r.driver_id as string) ?? 'Unknown',
      });
    }
    if (checkin) {
      const r = checkin as Record<string, unknown>;
      candidates.push({
        cableStatus:   (r.ev_cable_status as EvAssetStatus) ?? null,
        adapterStatus: (r.ev_adapter_status as EvAssetStatus) ?? null,
        when:          r.created_at as string,
        byName:        (r.checked_in_by_name as string) ?? 'Unknown',
      });
    }
    if (candidates.length === 0) { setLastEvCheck(null); return; }
    candidates.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    setLastEvCheck(candidates[0]);
  }, []);

  const handleVehicleSelected = useCallback((vehicle: Vehicle, timestamp: string) => {
    setScanned({ vehicle, timestamp });
    setUnitSearch('');
    setMileage('');
    setFuelLevel(null);
    setPhotoCount(0);
    setInteriorCondition(null);
    setExteriorCondition(null);
    setConditionNotes('');
    setSubmitted(false);
    setReHolded(false);
    setSaveError(false);
    setEvCableStatus(null);
    setEvAdapterStatus(null);
    setLastEvCheck(null);
    setLastMileage(null);
    fetchLastMileage(vehicle);
    if (isTesla(vehicle)) fetchEvLastCheck(vehicle);
  }, [fetchEvLastCheck, fetchLastMileage]);

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
    handleVehicleSelected(vehicle, timestamp);
  }, [getVehicleByUnit, showToast, handleVehicleSelected]);

  const handleSubmit = async () => {
    if (!scanned || !interiorCondition || !exteriorCondition) return;
    if (!user) { setSaveError(true); return; }
    hapticMedium();
    setSubmitting(true);
    setSaveError(false);

    const derivedRouting = deriveRouting(interiorCondition, exteriorCondition);
    const isTeslaVehicle = isTesla(scanned.vehicle);

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicle_checkins').insert({
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
        ev_cable_status:    isTeslaVehicle ? (evCableStatus ?? null) : null,
        ev_adapter_status:  isTeslaVehicle ? (evAdapterStatus ?? null) : null,
      })
    );

    setSubmitting(false);
    if (error) { setSaveError(true); return; }

    if (isTeslaVehicle && (evCableStatus === 'missing' || evAdapterStatus === 'missing')) {
      const missingAssets: string[] = [];
      if (evCableStatus === 'missing')   missingAssets.push('Mobile Charge Cable');
      if (evAdapterStatus === 'missing') missingAssets.push('J1772 Adapter');
      await addHold(
        scanned.vehicle.id,
        `Missing EV asset on return: ${missingAssets.join(', ')}`,
        `Flagged during check-in by ${user.name} at ${new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`,
        user.id,
        [],
        ['damage'],
      );
    }

    const validItems = foundItems.filter(i => i.description.trim());
    if (validItems.length > 0) {
      await Promise.all(validItems.map(item => addLostFoundItem({
        description:  item.description.trim(),
        location:     item.location,
        itemPhoto:    item.additionalPhoto,
        licensePlate: scanned.vehicle.licensePlate,
        unitNumber:   scanned.vehicle.unitNumber ?? undefined,
      })));
      setLoggedCount(validItems.length);
    }

    setSubmitted(true);

    // Fire-and-forget registry write — records arrival timestamp for turnaround tracking
    void createOrEnrichRegistry({
      branchId: user.branchId,
      vehicleId: scanned.vehicle.id,
      plate: scanned.vehicle.licensePlate,
      unitNumber: scanned.vehicle.unitNumber,
      make: scanned.vehicle.make,
      model: scanned.vehicle.model,
      year: scanned.vehicle.year,
      color: scanned.vehicle.color,
      arrivedAt: scanned.timestamp,
    });
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
    setEvCableStatus(null);
    setEvAdapterStatus(null);
    setLastEvCheck(null);
    setLastMileage(null);
    // PlateArrivalSection owns its own state — it auto-resets on unitSearch
    // changes and unmounts whenever a vehicle is scanned.
  };

  const handleReHold = useCallback(async (
    vehicleId: string,
    description: string,
    notes: string,
    photos: string[],
    linkedHoldId: string,
    holdTypes: HoldType[],
  ) => {
    if (!user) return;
    await addHold(vehicleId, description, notes, user.id, photos, holdTypes, undefined, undefined, linkedHoldId);
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
          <VehicleScanAndMatch
            vehicles={vehicles}
            unitSearch={unitSearch}
            onUnitSearchChange={setUnitSearch}
            onDecode={handleDecode}
            onSelectVehicle={handleVehicleSelected}
          />
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
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition ${
                    lastMileage !== null && mileage && Number(mileage) < lastMileage
                      ? 'border-amber-500 focus:ring-amber-500'
                      : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {lastMileage !== null && mileage && Number(mileage) < lastMileage && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                    ⚠️ Mileage is lower than last check-in ({lastMileage.toLocaleString()} km)
                  </p>
                )}
              </div>
              <FuelLevelSelector fuelLevel={fuelLevel} setFuelLevel={setFuelLevel} />
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
            <ConditionRatingsSelector
              interiorCondition={interiorCondition}
              setInteriorCondition={setInteriorCondition}
              exteriorCondition={exteriorCondition}
              setExteriorCondition={setExteriorCondition}
            />

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
            {routing && <CheckInRoutingPreview routing={routing} />}

            {scanned && isTesla(scanned.vehicle) && (
              <EVAssetCheck
                cableStatus={evCableStatus}
                adapterStatus={evAdapterStatus}
                onCableChange={setEvCableStatus}
                onAdapterChange={setEvAdapterStatus}
                lastCheck={lastEvCheck}
              />
            )}

            <LostFoundItemList
              show={showFoundSection}
              items={foundItems}
              onOpen={() => { setShowFoundSection(true); addFoundItem(); }}
              onAdd={addFoundItem}
              onRemove={removeFoundItem}
              onUpdate={updateFoundItem}
            />


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

      {toast && <Toast message={toast} />}
    </div>
  );
}
