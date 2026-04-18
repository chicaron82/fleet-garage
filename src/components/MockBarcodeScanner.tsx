import { useState } from 'react';
import type { ScannedPayload } from '../types';

const MOCK_POOL: ScannedPayload[] = [
  { unitNumber: '4821039', licensePlate: 'KMX204', make: 'Nissan',      model: 'Altima',         year: 2024, color: 'Silver' },
  { unitNumber: '3910472', licensePlate: 'BPT918', make: 'Toyota',      model: 'Camry',           year: 2025, color: 'Black' },
  { unitNumber: '6672841', licensePlate: 'RVQ553', make: 'Honda',       model: 'CR-V',            year: 2023, color: 'Blue' },
  { unitNumber: '7730194', licensePlate: 'DWZ771', make: 'Ford',        model: 'Escape',          year: 2024, color: 'White' },
  { unitNumber: '5519038', licensePlate: 'JKL329', make: 'Chevrolet',   model: 'Trailblazer',     year: 2025, color: 'Red' },
  { unitNumber: '8840271', licensePlate: 'MNP442', make: 'Mazda',       model: 'CX-5',            year: 2024, color: 'Grey' },
  { unitNumber: '2293847', licensePlate: 'QRS117', make: 'Kia',         model: 'Sportage',        year: 2025, color: 'White' },
  { unitNumber: '9901234', licensePlate: 'TUV884', make: 'Toyota',      model: 'RAV4',            year: 2023, color: 'Silver' },
  { unitNumber: '1184720', licensePlate: 'XYZ661', make: 'Nissan',      model: 'Kicks',           year: 2024, color: 'Orange' },
  { unitNumber: '3347891', licensePlate: 'ABD993', make: 'Hyundai',     model: 'Tucson',          year: 2025, color: 'Blue' },
];

interface Props {
  onScan: (payload: ScannedPayload, timestamp: string) => void;
  label?: string;
  disabled?: boolean;
}

export function MockBarcodeScanner({ onScan, label = 'Scan Vehicle', disabled = false }: Props) {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    if (disabled) return;
    setIsScanning(true);
    setTimeout(() => {
      const payload = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)];
      onScan(payload, new Date().toISOString());
      setIsScanning(false);
    }, 1200);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleScan}
        disabled={disabled || isScanning}
        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        <span className="text-base leading-none">⬡</span>
        {isScanning ? 'Scanning…' : label}
      </button>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
          {/* Viewfinder */}
          <div className="relative w-64 h-44 rounded-2xl border-2 border-green-400 overflow-hidden shadow-[0_0_40px_rgba(74,222,128,0.3)]">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-xl" />

            {/* Scanline */}
            <div className="animate-scanline absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_12px_4px_rgba(74,222,128,0.8)]" />

            {/* Inner dark bg */}
            <div className="absolute inset-0 bg-black/60" />
          </div>

          <p className="absolute bottom-16 text-green-400 text-sm font-medium tracking-widest uppercase opacity-80">
            Scanning barcode…
          </p>
        </div>
      )}
    </>
  );
}
