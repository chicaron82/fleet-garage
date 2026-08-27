// Two facts about a car that are neither identity nor damage — added 2026-08-27 when FG met its
// first US vehicle, a Florida-plated Jeep Compass up from the Fargo branch.
//
// ⚠️ WINTER TIRES FOLLOW THE UNTOUCHED-CONTROL RULE. An unticked box does NOT mean "no winter
// tires" — it means nobody looked, and those are different facts. FG already learned this on the EV
// asset checkboxes: a control he never touched must write nothing, or every car he registers and
// walks away from silently reports its tyres as summer. So the value stays `null` until he actually
// taps, and only then does it become an observation with a date.
export function RegisterVehicleFlags({ isUs, onIsUs, winterTires, onWinterTires }: {
  isUs: boolean;
  onIsUs: (v: boolean) => void;
  /** null = not assessed. Only a tap moves it off null. */
  winterTires: boolean | null;
  onWinterTires: (v: boolean) => void;
}) {
  const ROW = 'flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 cursor-pointer select-none';
  return (
    <>
      {/* 🇺🇸 Does more than it looks: it is also what makes every odometer surface on this car read
          MILES. Aaron declined anything louder than a flag — he knows it means "cannot be rented
          here, goes back to Fargo", and the record does not need to lecture him about his own fleet. */}
      <label className={ROW}>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          🇺🇸 US vehicle <span className="opacity-60">· odometer in miles</span>
        </span>
        <input
          type="checkbox"
          checked={isUs}
          onChange={e => onIsUs(e.target.checked)}
          className="w-5 h-5 accent-fg-yellow cursor-pointer"
        />
      </label>

      <label className={ROW}>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          ❄️ Winter tires
          {/* ⚠️ Says its own state out loud. Without this, an unticked box and a box he ticked-then-
              unticked look identical, and only one of them is a recorded "no". */}
          <span className="opacity-60">
            {winterTires === null ? ' · not checked' : winterTires ? ' · fitted' : ' · none fitted'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={winterTires === true}
          onChange={e => onWinterTires(e.target.checked)}
          className="w-5 h-5 accent-fg-yellow cursor-pointer"
        />
      </label>
    </>
  );
}
