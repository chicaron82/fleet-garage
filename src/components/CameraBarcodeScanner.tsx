import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

interface Props {
  onDecode: (raw: string, timestamp: string) => void;
  label?: string;
  disabled?: boolean;
}

export function CameraBarcodeScanner({ onDecode, label = 'Scan Barcode', disabled = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch { /* already stopped */ }
      controlsRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    stopCamera();
    setIsOpen(false);
    setError(null);
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const reader = new BrowserMultiFormatReader();

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
      if (controls && !controlsRef.current) {
        controlsRef.current = controls;
      }
      if (result) {
        const raw = result.getText();
        const timestamp = new Date().toISOString();
        stopCamera();
        setIsOpen(false);
        setError(null);
        onDecode(raw, timestamp);
      } else if (err && err.name !== 'NotFoundException') {
        // NotFoundException fires constantly while scanning — not an error
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied — check your browser settings');
          stopCamera();
        }
      }
    }).then(controls => {
      if (!controlsRef.current) {
        controlsRef.current = controls;
      }
    }).catch(e => {
      if (e?.name === 'NotAllowedError') {
        setError('Camera access denied — check your browser settings');
      } else {
        setError('Camera unavailable — try again');
      }
      stopCamera();
    });

    return () => stopCamera();
  }, [isOpen, onDecode, stopCamera]);

  return (
    <>
      <button
        type="button"
        onClick={() => { if (!disabled) setIsOpen(true); }}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        <span className="text-base leading-none">📷</span>
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">
          {/* Close */}
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-5 right-5 text-white/70 hover:text-white text-2xl leading-none transition cursor-pointer"
          >
            ✕
          </button>

          {/* Viewfinder */}
          <div className="relative w-72 h-52 rounded-2xl overflow-hidden border-2 border-green-400 shadow-[0_0_40px_rgba(74,222,128,0.3)]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-xl pointer-events-none" />
            {/* Scan line hint */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-green-400/60 shadow-[0_0_8px_2px_rgba(74,222,128,0.5)] pointer-events-none" />
          </div>

          {error ? (
            <p className="mt-5 text-red-400 text-sm font-medium text-center px-6">{error}</p>
          ) : (
            <p className="mt-5 text-green-400 text-sm font-medium tracking-widest uppercase opacity-80">
              Point at barcode…
            </p>
          )}
        </div>
      )}
    </>
  );
}
