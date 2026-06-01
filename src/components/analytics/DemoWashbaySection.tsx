import { DEMO_WASHBAY_TODAY, DEMO_WASHBAY_30DAY_AVG, COMPANY_STANDARD } from '../../lib/analytics';

/** Sample "Washbay Operations" panel shown in Analytics demo mode. Static data. */
export function DemoWashbaySection() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Cars In',    value: DEMO_WASHBAY_TODAY.carsIn },
          { label: 'Cleaned',    value: DEMO_WASHBAY_TODAY.carsCleaned },
          { label: 'Throughput', value: `${DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Pipeline</p>
        {[
          { label: 'Cars in',              value: DEMO_WASHBAY_TODAY.carsIn,             indent: false },
          { label: `Held today (${DEMO_WASHBAY_TODAY.heldToday})`, value: DEMO_WASHBAY_TODAY.heldToday, indent: true, minus: true },
          { label: 'Rentables processed',  value: DEMO_WASHBAY_TODAY.rentablesProcessed, indent: false },
          { label: 'Clean, not picked up', value: DEMO_WASHBAY_TODAY.cleanNotPickedUp,   indent: true, minus: true },
          { label: 'Delivered to airport', value: DEMO_WASHBAY_TODAY.deliveredToAirport, indent: false },
        ].map(({ label, value, indent, minus }) => (
          <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
            <span className="text-sm">{minus ? '− ' : ''}{label}</span>
            <span className="text-sm tabular-nums">{value}</span>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Net Flow (vs Opening)</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {DEMO_WASHBAY_TODAY.openingCarsOut} out → {DEMO_WASHBAY_TODAY.carsIn} in
          <span className="ml-2 font-semibold text-green-600 dark:text-green-400">Net +{DEMO_WASHBAY_TODAY.netFlow} today</span>
        </p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-4 py-3">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">vs Company Standard</p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">YWG team: <span className="font-bold">{DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr</span></span>
          <span className="text-sm text-gray-500 dark:text-gray-400">Standard: {COMPANY_STANDARD.toFixed(1)}/hr</span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">30-day avg: <span className="font-bold text-gray-800 dark:text-gray-200">{DEMO_WASHBAY_30DAY_AVG.toFixed(1)}/hr</span></span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{(DEMO_WASHBAY_30DAY_AVG - COMPANY_STANDARD).toFixed(1)} above ✅</span>
        </div>
      </div>
    </div>
  );
}
