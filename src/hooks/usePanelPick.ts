import { useState } from 'react';
import type { PanelPickerState } from '../components/holds/PanelPicker';

/** The picker's state: which panels, photos and description parts are ticked. Panels start at `startZones`;
 *  photos and parts start empty, because they are only asked once the pick is a split. */
export function usePanelPick(startZones: readonly string[]): PanelPickerState {
  const [zones, setZones] = useState<string[]>([...startZones]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  return { zones, setZones, photos, setPhotos, parts, setParts };
}
