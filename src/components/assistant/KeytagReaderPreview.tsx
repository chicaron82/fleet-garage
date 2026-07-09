// A read-only key-tag reader: upload a photo → /api/keytag-read → show exactly what it
// read off the tag. No fleet lookup, no write — a validation surface for the vision read
// (point real camera-roll key tags at it). The L&F flow that registers/backfills from a
// read is a later slice; this proves the READ in isolation.
import { useRef, useState } from 'react';
import { useKeytagRead } from '../../hooks/useKeytagRead';
import { compressImage } from '../../lib/image';

const FIELD_LABELS = [
  ['plate', 'Plate'],
  ['unitNumber', 'Unit #'],
  ['classCode', 'Class'],
  ['make', 'Make'],
  ['model', 'Model'],
  ['year', 'Year'],
  ['color', 'Colour'],
  ['bodyStyle', 'Body'],
] as const;

export function KeytagReaderPreview() {
  const { status, read, error, readKeytag } = useKeytagRead();
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = await compressImage(file);
    setPreview(img);
    await readKeytag(img);
  };

  const hasAny = read && FIELD_LABELS.some(([k]) => read[k] !== undefined && read[k] !== '');

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Key-tag reader (preview)
      </label>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={status === 'reading'}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
        >
          {status === 'reading' ? 'Reading…' : 'Upload a key-tag photo'}
        </button>
        {preview && <img src={preview} alt="Key tag" className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-gray-700" />}
      </div>

      {status === 'error' && <p className="text-[11px] text-red-500">{error}</p>}

      {status === 'done' && (
        hasAny ? (
          <div className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {FIELD_LABELS.filter(([k]) => read![k] !== undefined && read![k] !== '').map(([k, label]) => (
                <div key={k} className="contents">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-100">{String(read![k])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">No key-tag fields read from that photo.</p>
        )
      )}

      <p className="text-[11px] text-gray-400">Reads the tag and shows what it saw — nothing is saved.</p>
    </div>
  );
}
