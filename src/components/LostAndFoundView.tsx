import { useState } from 'react';
import { MOCK_LOST_FOUND } from '../data/lostAndFound';
import { MockBarcodeScanner } from './MockBarcodeScanner';
import { hapticMedium } from '../lib/haptics';
import type { ScannedPayload } from '../types';

function fmtRelative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric',
  });
}

export function LostAndFoundView() {
  const [scanned, setScanned] = useState<{ payload: ScannedPayload; timestamp: string } | null>(null);
  const [description, setDescription] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleScan = (payload: ScannedPayload, timestamp: string) => {
    setScanned({ payload, timestamp });
    setDescription('');
    setPhotoCount(0);
    setSubmitted(false);
  };

  const handleSubmit = () => { hapticMedium(); setSubmitted(true); };
  const handleReset = () => { setScanned(null); setSubmitted(false); };
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Lost & Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
            Items recovered from returned vehicles · {MOCK_LOST_FOUND.length} item{MOCK_LOST_FOUND.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
          Demo
        </span>
      </div>

      {/* Log found item */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Found Item</p>
          {scanned && (
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">Clear</button>
          )}
        </div>
        <div className="p-4 space-y-3">
          {!scanned && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Scan the vehicle the item was found in</p>
              <MockBarcodeScanner onScan={handleScan} label="Scan Vehicle" />
            </div>
          )}

          {scanned && !submitted && (
            <>
              <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3 transition-colors">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{scanned.payload.unitNumber} · {scanned.payload.licensePlate}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{scanned.payload.year} {scanned.payload.make} {scanned.payload.model}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Scanned {new Date(scanned.timestamp).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Item Description *</label>
                <textarea rows={2} placeholder="e.g. Black sunglasses, left in back seat…"
                  value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Photos (optional)</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPhotoCount(p => Math.min(p + 1, 4))}
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-xs leading-none">Photo</span>
                  </button>
                  {Array.from({ length: photoCount }).map((_, i) => (
                    <div key={i} className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors">
                      <span className="text-xl">📷</span>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={handleSubmit} disabled={!description.trim()}
                className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer">
                Submit Found Item
              </button>
            </>
          )}

          {submitted && scanned && (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <span className="text-3xl">📦</span>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Item logged</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Found in {scanned.payload.unitNumber} · {new Date(scanned.timestamp).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{description}"</p>
              <button type="button" onClick={handleReset}
                className="mt-1 text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer">
                Log another →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {MOCK_LOST_FOUND.map(item => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Placeholder photo */}
              <div className="shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center transition-colors">
                <span className="text-xl">📦</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm transition-colors">
                  {item.itemDescription}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors">
                  Found in <span className="font-medium text-gray-700 dark:text-gray-300">{item.vehicleUnit}</span>
                  {' '}by {item.foundBy} · {fmtDate(item.foundAt)} ({fmtRelative(item.foundAt)})
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                  Stored: {item.storageLocation}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {MOCK_LOST_FOUND.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No items in lost & found.</p>
        </div>
      )}
    </div>
  );
}
