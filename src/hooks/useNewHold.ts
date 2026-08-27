import { coverPhotoUrlFor, effectivePinnedIndex } from '../lib/coverPin';
import { useState, useRef } from 'react';
import { useRoutedProp } from './useRoutedProp';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { holdIsMappable, toggleZone as toggleZoneIds } from '../lib/damageZones';
import { compressImage } from '../lib/image';
import { MECHANICAL_PRESET_META } from '../lib/hold-presets';
import { findActiveTypeOverlap } from '../lib/holdFilters';
import type { HoldType, DetailReason, MechanicalSubType } from '../types';
import { DETAIL_REASON_LABELS } from '../types';

const MAX_PHOTOS = 4;

export function useNewHold(preselectedId?: string, preselectedNonce?: number) {
  const { user } = useAuth();
  const { vehicles, getActiveHold, getActiveHolds, addHold, setCoverPhoto, editHoldDamageZones, markZonesReviewed } = useVehicleHoldContext();

  const [unitSearch, setUnitSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedId ?? null);

  // `useState` above reads preselectedId only on MOUNT. Scanning a tag from the header while the
  // hold form is ALREADY open re-navigates to the same mounted component, so the new vehicle was
  // silently ignored and the form stayed pointed at the PREVIOUS car — i.e. a hold could land on
  // the wrong vehicle. Render-time adjustment (not an effect: the repo lints set-state-in-effect).
  // Same class as the movement-log prefill bug (9d1535f). docs/ticket-scan-router-trip-prefill.md
  useRoutedProp(preselectedId, setSelectedVehicleId);
  // ...but a value-keyed re-seed only fires once per distinct id, and a SCAN is an EVENT: after
  // `clearVehicle` blanks the selection, re-scanning the SAME tag routes the identical vehicleId,
  // so the line above no-ops and the form stays empty — the scan looks dead. (Exactly the LZM531
  // bug fixed for Start-trip / Lost-&-found on 2026-07-21; new-hold was the route left unstamped.)
  // Keyed on the per-scan nonce so a repeat re-selects. Both are needed: the value re-seed covers
  // non-scan navigations (vehicle screen → Flag, register → hold), which carry no nonce.
  useRoutedProp(preselectedNonce, () => setSelectedVehicleId(preselectedId ?? null));
  const [holdTypes, setHoldTypes] = useState<HoldType[]>(['damage']);
  // The category most recently toggled ON — drives scroll-to-section so a newly
  // revealed sub-section comes into view (the tap otherwise looks like a no-op).
  const [lastRevealedType, setLastRevealedType] = useState<HoldType | null>(null);
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');
  const [detailReason, setDetailReason] = useState<DetailReason | ''>('');
  const [mechanicalTypes, setMechanicalTypes] = useState<string[]>([]);
  const [customMechanical, setCustomMechanical] = useState('');
  const [mechanicalSubType, setMechanicalSubType] = useState<MechanicalSubType | null>(null);
  const [safetyRecallBypassChecked, setSafetyRecallBypassChecked] = useState(false);
  // ⚡ Where on the car, asked while he is still standing at it. Empty is a legitimate answer and
  // means NOT YET — the backfill queue still picks the hold up. Only an explicit `noPanelApplies`
  // tap says "there is nowhere to point"; see NewHoldDamageZones for why silence must not count.
  const [zones, setZones] = useState<string[]>([]);
  const [noPanelApplies, setNoPanelApplies] = useState(false);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  // Which photo (by index) to pin as the vehicle's card photo. Applied after the
  // upload resolves the final storage URL (the local preview isn't pinnable).
  const [pinnedPhotoIndex, setPinnedPhotoIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Synchronous in-flight lock — `submitting` is async state, so it can't guard
  // against two taps fired in the same render frame (see `submit`). The load-bearing
  // dedup now lives in `addHold` itself (shared `withSubmitLock`), so every caller is
  // protected; this ref stays as a UI early-out (the second tap never even flips
  // `submitting`), redundant-but-intentional.
  const inFlightRef = useRef(false);

  const selectedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : null;

  const alreadyHeld = selectedVehicleId
    ? !!getActiveHold(selectedVehicleId)
    : false;

  // Duplicate-flag advisory: active holds whose unresolved types overlap what's
  // being flagged. Informs the flagger (who/when), never blocks — the layer-2
  // dedup decision (2026-06-12): suppressing a legitimate second flag is worse
  // than a duplicate, which batch-resolve makes cheap to clean.
  const duplicateTypeOverlaps = selectedVehicleId
    ? findActiveTypeOverlap(getActiveHolds(selectedVehicleId), holdTypes)
    : [];

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
    holdTypes.includes('damage')     ? damageDesc     : '',
    holdTypes.includes('hail')       ? 'Hail damage'  : '',  // storm batch — specifics go in notes
    holdTypes.includes('detail')     ? detailDesc     : '',
    holdTypes.includes('mechanical') ? mechanicalDesc : '',
  ].filter(Boolean);
  // The two answers are exclusive by meaning, so make them exclusive by construction rather than
  // letting a stale one ride along: marking a panel retracts "nothing applies", and vice versa.
  const toggleZone = (id: string) => {
    setNoPanelApplies(false);
    setZones(prev => toggleZoneIds(prev, id));
  };
  const chooseNoPanelApplies = (v: boolean) => {
    setNoPanelApplies(v);
    if (v) setZones([]);
  };

  const finalDamage = isSaleCarOnly
    ? (notes.trim() ? `Sale car — ${notes.trim()}` : 'Sale car')
    : parts.join('; ');

  const damageOk     = !holdTypes.includes('damage')     || !!damageDesc;
  const detailOk     = !holdTypes.includes('detail')     || !!detailReason;
  const mechanicalOk = !holdTypes.includes('mechanical') || safetyRecallBypassActive ||
    (mechanicalTypes.filter(t => t !== 'Other').length > 0 ||
     (mechanicalTypes.includes('Other') && !!customMechanical.trim()));

  // Damage and hail are both photo-documented (assessment leans on the photo).
  const photosOk  = (!holdTypes.includes('damage') && !holdTypes.includes('hail')) || photos.length > 0;
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
    const isAdding = !holdTypes.includes(type);
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
    // Newly added → let the revealed sub-section scroll into view.
    if (isAdding) setLastRevealedType(type);
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
    // Keep the pin pointing at the same photo as the list shifts (or drop it if
    // the pinned photo was the one removed).
    setPinnedPhotoIndex(prev =>
      prev === null ? null : prev === index ? null : prev > index ? prev - 1 : prev
    );
  };

  // One pin max — tapping the pinned photo unpins; tapping another moves it.
  const togglePinPhoto = (index: number) => {
    setPinnedPhotoIndex(prev => prev === index ? null : index);
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
      const result = await addHold(selectedVehicle.id, finalDamage, notes, user.id, photos, holdTypes, detailReason || undefined, mechanicalSubType);
      // ⚠️ Written AFTER the hold exists, not as an 11th parameter to addHold — it takes ten
      // already, and six callers would have to change for one of them. `holdIsMappable` is the
      // queue's own predicate, so the form and the backfill can never disagree about whether this
      // hold should have had a zone.
      //
      // Best-effort by design: the hold is already created and is the record that matters. A lost
      // zone costs one pass through the backfill queue — which is exactly where an unanswered hold
      // goes anyway — while failing the submit here would strand a flagged car behind an error.
      if (result?.holdId && holdIsMappable(holdTypes, finalDamage)) {
        try {
          if (zones.length > 0) await editHoldDamageZones(result.holdId, zones);
          else if (noPanelApplies) await markZonesReviewed(result.holdId);
        } catch { /* the hold stands; the queue will ask again */ }
      }
      // Pin the chosen photo as the vehicle's card photo, using the final uploaded
      // URL. Length guard: if an upload failed it's filtered out of photoUrls and
      // indices would shift, so only pin when the counts match. Best-effort — a pin
      // failure must not fail the (already-created) hold.
      // ⭐ A SINGLE PHOTO PINS ITSELF. The tap exists to answer "which of these?" — with one photo
      // there is nothing to choose between, so he never tapped, so nothing pinned, and three live
      // holds sat in the worklist with no thumbnail beside cars that had one (Aaron, 2026-08-27:
      // *"pretty sure we made it so if only 1 photo is used for a hold, that's the one that gets
      // automatically pinned"* — right about the intent). The index/bounds guard that used to live
      // in this condition now lives in lib/coverPin, so the auto-pin cannot skip it.
      const coverUrl = result ? coverPhotoUrlFor(pinnedPhotoIndex, photos, result.photoUrls) : null;
      if (coverUrl) {
        try { await setCoverPhoto(selectedVehicle.id, coverUrl); }
        catch { /* the hold is created; the card-photo pin is a nicety */ }
      }
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
    selectedVehicle, alreadyHeld, duplicateTypeOverlaps, preselectedId,
    searchResults, noResults,
    holdTypes, holdType, toggleHoldType, isSaleCarOnly, lastRevealedType,
    damageTypes, toggleDamageType,
    customDamage, setCustomDamage,
    detailReason, setDetailReason,
    mechanicalTypes, toggleMechanicalType,
    customMechanical, setCustomMechanical,
    mechanicalSubType, setMechanicalSubType,
    safetyRecallBypassChecked, setSafetyRecallBypassChecked, safetyRecallBypassActive,
    zones, toggleZone, noPanelApplies, setNoPanelApplies: chooseNoPanelApplies,
    zonesApplicable: holdIsMappable(holdTypes, finalDamage),
    notes, setNotes,
    photos, removePhoto, handlePhotoAdd,
    // ⚠️ The EFFECTIVE index, not the raw one — so a lone photo renders as pinned while he is still
    // on the form. An automatic behaviour he only discovers afterwards on the list is a surprise;
    // one he can see is a default.
    pinnedPhotoIndex: effectivePinnedIndex(pinnedPhotoIndex, photos.length), togglePinPhoto,
    submitting, submitError, canSubmit, photosOk,
    selectVehicle, clearVehicle,
    submit,
    MAX_PHOTOS,
  };
}
