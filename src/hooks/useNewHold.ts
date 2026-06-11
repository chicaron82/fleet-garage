import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { compressImage } from '../lib/image';
import { MECHANICAL_PRESET_META } from '../lib/hold-presets';
import type { HoldType, DetailReason, MechanicalSubType } from '../types';
import { DETAIL_REASON_LABELS } from '../types';

const MAX_PHOTOS = 4;

export function useNewHold(preselectedId?: string) {
  const { user } = useAuth();
  const { vehicles, getActiveHold, addHold } = useVehicleHoldContext();

  const [unitSearch, setUnitSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedId ?? null);
  const [holdTypes, setHoldTypes] = useState<HoldType[]>(['damage']);
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [detailReason, setDetailReason] = useState<DetailReason | ''>('');
  const [mechanicalTypes, setMechanicalTypes] = useState<string[]>([]);
  const [customMechanical, setCustomMechanical] = useState('');
  const [mechanicalSubType, setMechanicalSubType] = useState<MechanicalSubType | null>(null);
  const [safetyRecallBypassChecked, setSafetyRecallBypassChecked] = useState(false);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Synchronous in-flight lock — `submitting` is async state, so it can't guard
  // against two taps fired in the same render frame (see `submit`).
  const inFlightRef = useRef(false);

  const selectedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;

  const alreadyHeld = selectedVehicleId
    ? !!getActiveHold(selectedVehicleId)
    : false;

  const searchResults = unitSearch.trim().length >= 2
    ? vehicles.filter(v =>
        (v.unitNumber?.toUpperCase() ?? '').includes(unitSearch) ||
        v.licensePlate.toUpperCase().includes(unitSearch)
      ).slice(0, 5)
    : [];

  const noResults = unitSearch.trim().length >= 2 && searchResults.length === 0;

  const safetyRecallBypassActive = mechanicalSubType === 'safety-recall' && safetyRecallBypassChecked;

  // Per-type descriptions
  const damageDesc = damageTypes.map(t => t === 'Other' ? customDamage.trim() : t).filter(Boolean).join('; ');
  const mechanicalDesc = safetyRecallBypassActive
    ? (notes.trim() ? `Safety / recall — ${notes.trim()}` : 'Safety / recall — no visible defect')
    : mechanicalTypes.map(t => t === 'Other' ? customMechanical.trim() : t).filter(Boolean).join('; ');
  const detailDesc = detailReason ? `Detail required — ${DETAIL_REASON_LABELS[detailReason as DetailReason] ?? ''}` : '';

  const isSaleCarOnly = holdTypes.length === 1 && holdTypes[0] === 'sale_car';

  const parts = [
    holdTypes.includes('damage')     ? damageDesc    : '',
    holdTypes.includes('detail')     ? detailDesc    : '',
    holdTypes.includes('mechanical') ? mechanicalDesc : '',
  ].filter(Boolean);
  const finalDamage = isSaleCarOnly
    ? (notes.trim() ? `Sale car — ${notes.trim()}` : 'Sale car')
    : parts.join('; ');

  const damageOk     = !holdTypes.includes('damage')     || !!damageDesc;
  const detailOk     = !holdTypes.includes('detail')     || !!detailReason;
  const mechanicalOk = !holdTypes.includes('mechanical') || safetyRecallBypassActive ||
    (mechanicalTypes.filter(t => t !== 'Other').length > 0 ||
     (mechanicalTypes.includes('Other') && !!customMechanical.trim()));

  const photosOk  = !holdTypes.includes('damage') || photos.length > 0;
  const canSubmit = !!(selectedVehicle && !submitting && damageOk && detailOk && mechanicalOk && photosOk);

  // Primary holdType for backwards compat
  const holdType = holdTypes[0];

  const isHoldTypeEmpty = (t: HoldType): boolean => {
    if (t === 'damage')     return damageTypes.length === 0;
    if (t === 'mechanical') return mechanicalTypes.length === 0;
    if (t === 'detail')     return !detailReason;
    return false;
  };

  const toggleHoldType = (type: HoldType) => {
    setHoldTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // can't deselect last
        return prev.filter(t => t !== type);
      }
      if (type === 'sale_car') return ['sale_car'];
      const next = [...prev.filter(t => t !== 'sale_car'), type];
      // Auto-deselect any other type that has no content filled in yet
      return next.filter(t => t === type || !isHoldTypeEmpty(t));
    });
  };

  const toggleDamageType = (preset: string) => {
    setDamageTypes(prev =>
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const toggleMechanicalType = (preset: string) => {
    const next = mechanicalTypes.includes(preset)
      ? mechanicalTypes.filter(p => p !== preset)
      : [...mechanicalTypes, preset];
    setMechanicalTypes(next);
    // Derive mechanicalSubType from selected concerns
    const safetySelected = next.some(p => MECHANICAL_PRESET_META[p]?.subType === 'safety-recall');
    const firstSpecific = next.find(p => {
      const st = MECHANICAL_PRESET_META[p]?.subType;
      return st && st !== 'other' && st !== 'safety-recall';
    });
    setMechanicalSubType(
      next.length === 0 ? null :
      safetySelected ? 'safety-recall' :
      firstSpecific ? MECHANICAL_PRESET_META[firstSpecific].subType as MechanicalSubType :
      'other'
    );
  };

  const selectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setUnitSearch('');
  };

  const clearVehicle = () => setSelectedVehicleId(null);

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    const compressed = await Promise.all(toAdd.map(compressImage));
    setPhotos(prev => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async (): Promise<string | null> => {
    // `canSubmit` is derived from `submitting` STATE, which doesn't flip until the
    // next render — so two rapid taps (or a re-fired handler on a slow network) can
    // both pass this guard before either re-renders, and each would flag a SEPARATE
    // hold with its own UUID. The ref flips synchronously, closing the window the
    // state-derived guard can't. Cleared in `finally`, so the lock always releases.
    if (!canSubmit || !selectedVehicle || inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      if (!user?.id || !user?.name) {
        setSubmitError('Session error — please refresh and try again.');
        return null;
      }
      setSubmitError(null);
      setSubmitting(true);
      await addHold(selectedVehicle.id, finalDamage, notes, user.id, photos, holdTypes, detailReason || undefined, mechanicalSubType);
      return selectedVehicle.id;
    } catch {
      setSubmitError('Something went wrong. Please try again.');
      return null;
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  return {
    user: user!,
    unitSearch, setUnitSearch,
    selectedVehicle, alreadyHeld, preselectedId,
    searchResults, noResults,
    holdTypes, holdType, toggleHoldType, isSaleCarOnly,
    damageTypes, toggleDamageType,
    customDamage, setCustomDamage,
    detailReason, setDetailReason,
    mechanicalTypes, toggleMechanicalType,
    customMechanical, setCustomMechanical,
    mechanicalSubType, setMechanicalSubType,
    safetyRecallBypassChecked, setSafetyRecallBypassChecked, safetyRecallBypassActive,
    notes, setNotes,
    photos, removePhoto, handlePhotoAdd,
    submitting, submitError, canSubmit, photosOk,
    selectVehicle, clearVehicle,
    submit,
    MAX_PHOTOS,
  };
}
