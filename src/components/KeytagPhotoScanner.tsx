import { useRef, useState } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { parseKeytag } from '../lib/ocr-parser';
import type { ScannedPayload } from '../types';

interface Props {
  onScan: (payload: ScannedPayload) => void;
}

type ScanState = 'idle' | 'processing' | 'done' | 'error';

export function KeytagPhotoScanner({ onScan }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    hapticLight();
    setState('processing');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      try {
        const payload = await parseKeytag(dataUrl);
        hapticMedium();
        setState('done');
        onScan(payload);
      } catch {
        setState('error');
        setErrorMsg('OCR failed — enter details manually.');
      } finally {
        // Reset input so same image can be retried
        if (inputRef.current) inputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setState('idle');
    setPreview(null);
    setErrorMsg('');
  };

  return (
    <div className="space-y-3">
      {/* Hidden camera input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleCapture}
      />

      {/* Scan button */}
      {state === 'idle' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-yellow-400 dark:hover:border-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <span className="text-lg">📷</span>
          Snap Keytag
        </button>
      )}

      {/* Processing */}
      {state === 'processing' && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
          {preview && (
            <img
              src={preview}
              alt="Keytag preview"
              className="w-full max-h-48 object-contain rounded-lg mb-3 opacity-60"
            />
          )}
          <div className="flex items-center gap-2 justify-center">
            <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-amber-700 dark:text-amber-300">Reading keytag…</span>
          </div>
        </div>
      )}

      {/* Done */}
      {state === 'done' && (
        <div className="rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10 p-3 flex items-center justify-between">
          <span className="text-sm text-green-700 dark:text-green-300 font-semibold">✓ Keytag read</span>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-green-600 dark:text-green-400 hover:underline cursor-pointer"
          >
            Scan another
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 p-3 flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-300">{errorMsg}</span>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
