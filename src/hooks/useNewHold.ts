import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { compressImage } from '../lib/image';
import type { HoldType, DetailReason } from '../types';
import { DETAIL_REASON_LABELS } from '../types';

const MAX_PHOTOS = 4;

export function useNewHold(preselectedId?: string) {
  const { user } = useAuth();
  const { vehicles, getActiveHold, addHold } = useGarage();

  const [unitSearch, setUnitSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedId ?? null);
  const [holdType, setHoldType] = useState<HoldType>('damage');
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [detailReason, setDetailReason] = useState<DetailReason | ''>('');
  const [mechanicalTypes, setMechanicalTypes] = useState<string[]>([]);
  const [customMechanical, setCustomMechanical] = useState('');
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
  const finalDamage = holdType === 'detail'
    ? `Detail required — ${DETAIL_REASON_LABELS[detailReason as DetailReason] ?? ''}`
    : holdType === 'mechanical'
      ? mechanicalTypes.map(t => t === 'Other' ? customMechanical.trim() : t).filter(Boolean).join('; ')
      : damageTypes.map(t => t === 'Other' ? customDamage.trim() : t).filter(Boolean).join('; ');

  const canSubmit = selectedVehicle && !alreadyHeld && !submitting && (
    holdType === 'damage' ? !!finalDamage :
    holdType === 'detail' ? !!detailReason :
    mechanicalTypes.filter(t => t !== 'Other').length > 0 || (mechanicalTypes.includes('Other') && !!customMechanical.trim())
  );

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

  const switchHoldType = (type: HoldType) => {
    setHoldType(type);
    if (type !== 'damage') { setDamageTypes([]); setCustomDamage(''); }
    if (type !== 'detail') { setDetailReason(''); }
    if (type !== 'mechanical') { setMechanicalTypes([]); setCustomMechanical(''); }
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotos(prev => [...prev, compressed]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async (): Promise<string | null> => {
    if (!canSubmit || !selectedVehicle) return null;
    setSubmitting(true);
    try {
      await addHold(selectedVehicle.id, finalDamage, notes, user!.id, photos, holdType, detailReason || undefined);
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
    holdType, switchHoldType,
    damageTypes, toggleDamageType,
    customDamage, setCustomDamage,
    detailReason, setDetailReason,
    mechanicalTypes, toggleMechanicalType,
    customMechanical, setCustomMechanical,
    notes, setNotes,
    photos, removePhoto, handlePhotoAdd,
    submitting, canSubmit,
    selectVehicle, clearVehicle,
    submit,
    MAX_PHOTOS,
  };
}
