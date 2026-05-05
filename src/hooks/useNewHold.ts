import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { compressImage } from '../lib/image';
import type { HoldType, DetailReason, MechanicalSubType } from '../types';
import { DETAIL_REASON_LABELS } from '../types';

const MAX_PHOTOS = 4;

export function useNewHold(preselectedId?: string) {
  const { user } = useAuth();
  const { vehicles, getActiveHold, addHold } = useGarage();

  const [unitSearch, setUnitSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedId ?? null);
  const [holdTypes, setHoldTypes] = useState<HoldType[]>(['damage']);
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [detailReason, setDetailReason] = useState<DetailReason | ''>('');
  const [mechanicalTypes, setMechanicalTypes] = useState<string[]>([]);
  const [customMechanical, setCustomMechanical] = useState('');
  const [mechanicalSubType, setMechanicalSubType] = useState<MechanicalSubType | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;

  const alreadyHeld = selectedVehicleId
    ? !!getActiveHold(selectedVehicleId)
    : false;

  const searchResults = unitSearch.trim().length >= 2
    ? vehicles.filter(v =>
        v.unitNumber.toUpperCase().includes(unitSearch) ||
        v.licensePlate.toUpperCase().includes(unitSearch)
      ).slice(0, 5)
    : [];

  const noResults = unitSearch.trim().length >= 2 && searchResults.length === 0;

  // Per-type descriptions
  const damageDesc = damageTypes.map(t => t === 'Other' ? customDamage.trim() : t).filter(Boolean).join('; ');
  const mechanicalDesc = mechanicalTypes.map(t => t === 'Other' ? customMechanical.trim() : t).filter(Boolean).join('; ');
  const detailDesc = detailReason ? `Detail required — ${DETAIL_REASON_LABELS[detailReason as DetailReason] ?? ''}` : '';

  const parts = [
    holdTypes.includes('damage')     ? damageDesc    : '',
    holdTypes.includes('detail')     ? detailDesc    : '',
    holdTypes.includes('mechanical') ? mechanicalDesc : '',
  ].filter(Boolean);
  const finalDamage = parts.join('; ');

  const damageOk     = !holdTypes.includes('damage')     || !!damageDesc;
  const detailOk     = !holdTypes.includes('detail')     || !!detailReason;
  const mechanicalOk = !holdTypes.includes('mechanical') ||
    (mechanicalTypes.filter(t => t !== 'Other').length > 0 ||
     (mechanicalTypes.includes('Other') && !!customMechanical.trim()));

  const canSubmit = !!(selectedVehicle && !alreadyHeld && !submitting && damageOk && detailOk && mechanicalOk);

  // Primary holdType for backwards compat
  const holdType = holdTypes[0];

  const toggleHoldType = (type: HoldType) => {
    setHoldTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // can't deselect last
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const toggleDamageType = (preset: string) => {
    setDamageTypes(prev =>
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const toggleMechanicalType = (preset: string) => {
    setMechanicalTypes(prev =>
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
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
    if (!canSubmit || !selectedVehicle) return null;
    setSubmitting(true);
    try {
      await addHold(selectedVehicle.id, finalDamage, notes, user!.id, photos, holdTypes, detailReason || undefined, mechanicalSubType);
      return selectedVehicle.id;
    } catch {
      setSubmitting(false);
      return null;
    }
  };

  return {
    user: user!,
    unitSearch, setUnitSearch,
    selectedVehicle, alreadyHeld, preselectedId,
    searchResults, noResults,
    holdTypes, holdType, toggleHoldType,
    damageTypes, toggleDamageType,
    customDamage, setCustomDamage,
    detailReason, setDetailReason,
    mechanicalTypes, toggleMechanicalType,
    customMechanical, setCustomMechanical,
    mechanicalSubType, setMechanicalSubType,
    notes, setNotes,
    photos, removePhoto, handlePhotoAdd,
    submitting, canSubmit,
    selectVehicle, clearVehicle,
    submit,
    MAX_PHOTOS,
  };
}
