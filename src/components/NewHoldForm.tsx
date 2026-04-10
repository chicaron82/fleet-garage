import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import type { HoldType, DetailReason } from '../types';
import { DETAIL_REASON_LABELS } from '../types';

interface Props {
  vehicleId?: string;   // pre-selected from VehicleHistory → "Flag Damage"
  onBack: () => void;
  onSuccess: (vehicleId: string) => void;
  onRegisterNew?: (prefill?: string) => void;
}

const DAMAGE_PRESETS = [
  'Scratch — paint surface',
  'Scratch — to bare metal',
  'Dent — minor (no paint break)',
  'Dent — major / crumple',
  'Cracked windshield',
  'Broken glass (window / mirror)',
  'Bumper damage — cosmetic',
  'Bumper damage — structural',
  'Interior stain',
  'Interior damage (seat / trim)',
  'Mechanical concern',
  'Missing part / accessory',
  'Tire damage / flat',
  'Other',
];

const MAX_PHOTOS = 4;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function NewHoldForm({ vehicleId: preselectedId, onBack, onSuccess, onRegisterNew }: Props) {
  const { user } = useAuth();
  const { vehicles, getActiveHold, addHold } = useGarage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [unitSearch, setUnitSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedId ?? null);

  const [holdType, setHoldType] = useState<HoldType>('damage');
  const [damageType, setDamageType] = useState('');
  const [customDamage, setCustomDamage] = useState('');
  const [detailReason, setDetailReason] = useState<DetailReason | ''>('');
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
    : damageType === 'Other' ? customDamage.trim() : damageType;
  const canSubmit = selectedVehicle && !alreadyHeld && !submitting &&
    (holdType === 'damage' ? !!finalDamage : !!detailReason);

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setUnitSearch('');
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotos(prev => [...prev, compressed]);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedVehicle) return;

    setSubmitting(true);
    try {
      await addHold(selectedVehicle.id, finalDamage, notes, user!.id, photos, holdType, detailReason || undefined);
      onSuccess(selectedVehicle.id);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-900 transition cursor-pointer text-sm flex items-center gap-1"
        >
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900 text-sm">Flag Damage</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Vehicle Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Vehicle
            </h2>

            {selectedVehicle ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedVehicle.unitNumber}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.color}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">Plate: {selectedVehicle.licensePlate}</p>
                  </div>
                  {!preselectedId && (
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleId(null)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                </div>
                {alreadyHeld && (
                  <div className="mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    This vehicle already has an active hold. Only one active hold per vehicle is allowed.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Search by unit # or plate…"
                  value={unitSearch}
                  onChange={e => setUnitSearch(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
                />
                {searchResults.length > 0 && (
                  <div className="space-y-1">
                    {searchResults.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVehicle(v.id)}
                        className="w-full text-left px-3.5 py-2.5 rounded-lg border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition text-sm cursor-pointer"
                      >
                        <span className="font-medium text-gray-900">{v.unitNumber}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-500">{v.licensePlate}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-500">{v.year} {v.make} {v.model}</span>
                      </button>
                    ))}
                  </div>
                )}
                {noResults && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500">"{unitSearch}" not in the system.</p>
                    {onRegisterNew && (
                      <button
                        type="button"
                        onClick={() => onRegisterNew(unitSearch)}
                        className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer whitespace-nowrap ml-3"
                      >
                        + Add to ledger →
                      </button>
                    )}
                  </div>
                )}
                {unitSearch.trim().length < 2 && (
                  <p className="text-xs text-gray-400">Type at least 2 characters to search.</p>
                )}
              </div>
            )}
          </div>

          {/* Hold Details */}
          {selectedVehicle && !alreadyHeld && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                What are you flagging?
              </h2>

              {/* Hold Type Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setHoldType('damage'); setDetailReason(''); }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                    holdType === 'damage'
                      ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-semibold">Damage</span>
                  <span className="block text-xs opacity-70 mt-0.5">Dents, scratches, glass…</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setHoldType('detail'); setDamageType(''); setCustomDamage(''); }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition cursor-pointer text-left ${
                    holdType === 'detail'
                      ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-semibold">Detail Issue</span>
                  <span className="block text-xs opacity-70 mt-0.5">Dirt, pet hair, smoke…</span>
                </button>
              </div>

              {/* Damage Type */}
              {holdType === 'damage' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                  Damage Type *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DAMAGE_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDamageType(preset)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                        damageType === preset
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {damageType === 'Other' && (
                  <input
                    type="text"
                    placeholder="Describe the damage…"
                    value={customDamage}
                    onChange={e => setCustomDamage(e.target.value)}
                    className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                  />
                )}
              </div>
              )}

              {/* Detail Reason */}
              {holdType === 'detail' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                  Detail Reason *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(DETAIL_REASON_LABELS) as [DetailReason, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDetailReason(key)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition cursor-pointer ${
                        detailReason === key
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Location, customer context, circumstances…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                  Photos (optional · max {MAX_PHOTOS})
                </label>
                <div className="flex flex-wrap gap-2">
                  {photos.map((src, i) => (
                    <div key={i} className="relative">
                      <img
                        src={src}
                        alt={`Damage photo ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer leading-none transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-1"
                    >
                      <span className="text-xl leading-none">+</span>
                      <span className="text-xs">Photo</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoAdd}
                  className="hidden"
                />
              </div>

              {/* Flagging as */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500">
                Flagging as <span className="font-medium text-gray-700">{user!.name}</span> · {user!.role}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-200 disabled:text-gray-400 text-black font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? 'Flagging…' : 'Flag Damage'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
