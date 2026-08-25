// What the register form says AFTER a submit has landed — the two fixed-position banners.
//
// Split out of RegisterVehicleForm 2026-08-25 (the form crossed the 330 cap when registration
// adopted the shared EV control). They belong together because they answer the same question in
// two tones, and the distinction is load-bearing:
//
//   successToast → the registration worked. Green, or AMBER when a follow-on write didn't land.
//   releaseWarning → the registration worked, but the old record still holds the unit#.
//
// ⚠️ Both describe a car that IS registered. Neither is a failure banner — a failed registration
// never gets here, it just re-enables the submit button. That's why the amber tone exists at all:
// "registered, but something after it didn't" is a genuinely different thing to say than "failed",
// and rendering it in the green toast would be a lie about what actually landed.

export interface RegisterSuccessToast {
  text: string;
  tone: 'ok' | 'warn';
}

export interface RegisterReleaseWarning {
  /** Plate of the record that still wrongly carries the unit#. */
  old: string;
  vehicleId: string;
}

export function RegisterResultBanners({ successToast, releaseWarning, unit, onAcknowledge }: {
  successToast: RegisterSuccessToast | null;
  releaseWarning: RegisterReleaseWarning | null;
  unit: string;
  /** Cancels the auto-advance and navigates now — the warning is the one banner he must dismiss. */
  onAcknowledge: (vehicleId: string) => void;
}) {
  return (
    <>
      {successToast && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className={`max-w-md px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl backdrop-blur-sm ${successToast.tone === 'warn' ? 'bg-amber-600/95' : 'bg-green-800/90'}`}>
            {successToast.text}
          </div>
        </div>
      )}

      {releaseWarning && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center">
          <button
            type="button"
            onClick={() => onAcknowledge(releaseWarning.vehicleId)}
            className="max-w-md px-5 py-3 rounded-2xl bg-amber-600/95 text-white text-sm font-medium text-left shadow-xl backdrop-blur-sm transition hover:bg-amber-600 cursor-pointer"
          >
            ⚠️ Registered — but unit #{unit} couldn&apos;t be cleared from old record{' '}
            <span className="font-semibold">{releaseWarning.old}</span>. Check it and remove the unit# if
            needed. <span className="underline whitespace-nowrap">Got it →</span>
          </button>
        </div>
      )}
    </>
  );
}
