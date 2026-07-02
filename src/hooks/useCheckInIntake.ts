import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useLostFoundContext } from '../context/LostFoundContext';
import type { EvLastCheck } from '../components/movement/EVAssetCheck';
import type { InlineFoundItem } from '../components/lost-and-found/LostFoundItemList';
import { parseFleetBarcode } from '../lib/barcode';
import { hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import { isTesla } from '../lib/vehicles';
import { createOrEnrichRegistry } from '../lib/vehicleRegistry';
import type { Vehicle, ConditionRating, CheckInRouting, EvAssetStatus, HoldType } from '../types';
import { deriveRouting } from '../types';

/**
 * All state, data-loading, and handlers for the vehicle check-in intake flow.
 * The CheckInIntakeForm component consumes this and renders; no logic lives in
 * the component (FG slice-hook pattern — cf. useNewHold).
 */
export function useCheckInIntake() {
  const { user } = useAuth();
  const { vehicles, getVehicleByUnit, getHoldsForVehicle, addHold, updateVehicleEVAssets } = useVehicleHoldContext();
  const { addLostFoundItem } = useLostFoundContext();

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
        .eq('vehicle_unit', unit ?? '')
        .not('ev_cable_status', 'is', null)
        .order('depart_time', { ascending: false })
        .limit(1).maybeSingle(),
      supabase.from('vehicle_checkins')
        .select('ev_cable_status, ev_adapter_status, checked_in_at, checked_in_by_name')
        .eq('vehicle_id', vehicle.id)
        .not('ev_cable_status', 'is', null)
        .order('checked_in_at', { ascending: false })
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
        when:          r.checked_in_at as string,
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

    // `submitting` only disables on the next render, so a same-frame double-tap
    // files two check-in rows for the vehicle (and re-runs the found-items batch
    // below). Guard the insert on the vehicle; a dropped re-entrant tap resolves
    // undefined, so bail out of the whole submit before the downstream writes.
    const insertResult = await withSubmitLock(`checkin:${scanned.vehicle.id}`, () =>
      writeWithRefresh(() =>
        supabase.from('vehicle_checkins').insert({
          branch_id:          user.branchId,
          vehicle_id:         scanned.vehicle.id,
          vehicle_unit:       scanned.vehicle.unitNumber ?? '',
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
      )
    );
    if (!insertResult) { setSubmitting(false); return; }
    const { error } = insertResult;

    setSubmitting(false);
    if (error) { setSaveError(true); return; }

    // Propagate the observed EV status to the canonical profile + unified timeline
    // (so the profile stops silently staying wrong, from the check-in angle too).
    if (isTeslaVehicle && evCableStatus != null && evAdapterStatus != null) {
      await updateVehicleEVAssets(scanned.vehicle.id, evCableStatus === 'present', evAdapterStatus === 'present', 'check_in');
    }

    if (isTeslaVehicle && (evCableStatus === 'missing' || evAdapterStatus === 'missing')) {
      const missingAssets: string[] = [];
      if (evCableStatus === 'missing')   missingAssets.push('Mobile Charge Cable');
      if (evAdapterStatus === 'missing') missingAssets.push('J1772 Adapter');
      try {
        await addHold(
          scanned.vehicle.id,
          `Missing EV asset on return: ${missingAssets.join(', ')}`,
          `Flagged during check-in by ${user.name} at ${new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`,
          user.id,
          [],
          ['damage'],
        );
      } catch {
        // The check-in row already saved above; the EV-asset hold is a best-effort
        // follow-up. A failed addHold throws — don't let it abort the success flow
        // (setSubmitted below), just flag it so staff can hold manually.
        showToast('Check-in saved, but flagging the missing EV asset failed — add a hold manually.');
      }
    }

    const validItems = foundItems.filter(i => i.description.trim());
    if (validItems.length > 0) {
      // Sequential, not Promise.all: addLostFoundItem's submit lock keys on
      // content, so two batch items with the SAME description (two phone
      // chargers) fired concurrently would collide on the key and silently
      // drop one row. Run in order — the lock releases between items — and
      // count what actually landed rather than what we attempted.
      let logged = 0;
      for (const item of validItems) {
        const ok = await addLostFoundItem({
          description:  item.description.trim(),
          location:     item.location,
          itemPhoto:    item.additionalPhoto,
          licensePlate: scanned.vehicle.licensePlate,
          unitNumber:   scanned.vehicle.unitNumber ?? undefined,
        });
        if (ok) logged++;
      }
      setLoggedCount(logged);
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

  const canSubmit = !!interiorCondition && !!exteriorCondition && !submitting && scanned?.vehicle.status !== 'HELD';

  return {
    // context passthrough for render
    user, vehicles, getHoldsForVehicle,
    // state
    scanned, unitSearch, setUnitSearch,
    mileage, setMileage, fuelLevel, setFuelLevel, photoCount, setPhotoCount,
    interiorCondition, setInteriorCondition, exteriorCondition, setExteriorCondition,
    conditionNotes, setConditionNotes,
    submitted, reHolded, submitting, saveError, toast,
    showFoundSection, setShowFoundSection, foundItems, loggedCount,
    evCableStatus, setEvCableStatus, evAdapterStatus, setEvAdapterStatus,
    lastEvCheck, lastMileage,
    // derived
    routing, canSubmit,
    // handlers
    handleDecode, handleVehicleSelected, handleSubmit, handleReset, handleReHold,
    addFoundItem, removeFoundItem, updateFoundItem,
  };
}
