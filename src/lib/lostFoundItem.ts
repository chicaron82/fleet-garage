// Normalizing a found-item form into the row the L&F write expects. Pure — extracted from
// LogLostFoundItemModal so the "blank means absent" rule is testable without the wizard: every
// optional text field is trimmed, and an empty one becomes `undefined` (not '') so it never
// writes a meaningless blank string onto the record.
import type { LostFoundLocation } from '../types';

export interface LostFoundItemDraft {
  keyTagPhoto: string | null;
  itemPhoto: string | null;
  description: string;
  location: LostFoundLocation | null;
  licensePlate: string;
  notes: string;
}

export interface LostFoundItemInput {
  keyTagPhoto?: string;
  itemPhoto?: string;
  description?: string;
  location?: LostFoundLocation;
  licensePlate?: string;
  notes?: string;
}

/** Trim the text fields; drop anything empty/null so absent stays absent. */
export function buildLostFoundItemInput(d: LostFoundItemDraft): LostFoundItemInput {
  return {
    keyTagPhoto: d.keyTagPhoto ?? undefined,
    itemPhoto: d.itemPhoto ?? undefined,
    description: d.description.trim() || undefined,
    location: d.location ?? undefined,
    licensePlate: d.licensePlate.trim() || undefined,
    notes: d.notes.trim() || undefined,
  };
}
