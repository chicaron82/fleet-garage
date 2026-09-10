import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import { BuildStamp } from './BuildStamp';
import { ModuleGuideModal } from '../shared/ModuleGuideModal';
import { usePreferences } from '../../context/PreferencesContext';
import { ActiveSessionPill } from './ActiveSessionPill';
import { useScanRouter } from '../../context/scanRouter';
import { OffStdEditApprovalSheet } from '../off-standard/OffStdEditApprovalSheet';
import { BackdateApprovalSheet } from '../off-standard/BackdateApprovalSheet';
import { VehicleEditApprovalSheet } from '../vehicle/VehicleEditApprovalSheet';
import { hapticLight } from '../../lib/haptics';
import { useNavigatorOnLine } from '../../hooks/useNavigatorOnLine';
import type { Module, Screen } from '../../types';

interface Props {
  activeModule: Module;
  /** Identity of the active screen — changing it scrolls the content area back to top. */
  screenKey: string;
  onNavigate: (screen: Screen) => void;
  children: React.ReactNode;
}

export function AppShell({ activeModule, screenKey, onNavigate, children }: Props) {
  const isOnline = useNavigatorOnLine();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scanRouter = useScanRouter();

  // Reset the content scroll on navigation so a new screen starts at the top —
  // otherwise you land scrolled past the sticky nav (← Back off-screen) after,
  // e.g., submitting a long flag form.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [screenKey]);
  const [guideModule, setGuideModule] = useState<Module | null>(null);
  // Onboarding chrome, switchable off — see Preferences.showModuleGuide. Withholding the callback
  // is what removes the sidebar's per-item ⓘ too: Sidebar already renders it behind
  // `{onShowGuide && …}`, so one flag retires both affordances without a second conditional.
  const { prefs } = usePreferences();
  const guidesOn = prefs.showModuleGuide;
  const [pendingApprovalEntryId, setPendingApprovalEntryId] = useState<string | null>(null);
  const [pendingBackdateId, setPendingBackdateId]           = useState<string | null>(null);
  const [pendingVehicleEditId, setPendingVehicleEditId]     = useState<string | null>(null);

  const handleNavigate = (screen: Screen) => {
    onNavigate(screen);
    setSidebarOpen(false);
  };

  // A notification tapped in the sidebar opens its approval sheet here, and the phone drawer
  // gets out of the way so the sheet isn't behind it.
  const notificationActions = {
    onOffStdEditApproval:  (id: string) => { setPendingApprovalEntryId(id); setSidebarOpen(false); },
    onBackdateApproval:    (id: string) => { setPendingBackdateId(id);      setSidebarOpen(false); },
    onVehicleEditApproval: (id: string) => { setPendingVehicleEditId(id);   setSidebarOpen(false); },
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* The slide-in transform is scoped to `max-md:` so that at desktop this element carries NO
          transform at all. Any transform other than `none` makes an
          element the containing block for its `position: fixed` descendants — so with a translate
          still applied at desktop, every modal rendered from inside the sidebar (the profile menu's
          Settings and Profile sheets, and its Module Guide) resolved `fixed inset-0` against this
          w-64 column instead of the viewport, and rendered ~224px wide with every label wrapped to
          three lines. The header's own guide modal looked fine because it lives outside this div,
          which is exactly what made the bug hard to see. Found 2026-08-17 while render-checking the
          guide toggle, which had just moved a new row into that squeezed modal.

          ⚠️ `md:transform-none` was tried first and does NOT work — and the reason matters, because
          the obvious next guess (force it with `!`) is also wrong. Tailwind v4 emits
          `-translate-x-full` as **`translate: var(--tw-translate-x) …`**, the standalone `translate`
          property — while `transform-none` emits **`transform: none`**. Different properties
          entirely, so there is no specificity fight to win; it simply never applies. (Verified by
          grepping the built CSS, 2026-08-18, after an earlier version of this comment confidently
          asserted a "cascade race" that does not exist.) And per spec a non-`none` `translate`
          creates a containing block for fixed descendants exactly like `transform` does — which is
          why the bug existed at all. Scoping the translate to `max-md:` leaves the property unset
          at desktop, which is the only thing that actually fixes it.

          ⚠️ The same trap applies to the phone drawer while it's OPEN, and since 2026-09-10 it
          matters: the profile menu now lives in the drawer at every size, and its Settings /
          Profile / About / Guide modals render inside it. `translate-x-0` still emits
          `translate: 0 0` — a non-`none` value, so a containing block — and Settings would
          open 256px wide inside the drawer. The open state is therefore `translate-none`
          (`translate: none`), which the transition still animates (none interpolates as 0).

          The sidebar is on the RIGHT at every size (thumb side — Aaron, wrist brace, 2026-09-10:
          *"i thought we were moving it to the right side for both orientations"*). The phone
          drawer gets there with `right-0`; desktop is `md:static` in a flex row, where `right-0`
          means nothing, so `md:order-last` puts the column after the content instead. Order, not
          a translate — nothing may put a translate on this element at `md` (see above). */}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-64 max-md:transition-transform duration-200 md:static md:order-last ${
          sidebarOpen ? 'max-md:translate-none' : 'max-md:translate-x-full'
        }`}
      >
        <Sidebar
          activeModule={activeModule}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
          onShowGuide={guidesOn ? setGuideModule : undefined}
          notificationActions={notificationActions}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ONE top bar at every size (2026-09-10). It used to be phone-only, so 🔍 and 📷 were too, and
            couch command had no way to either. Aaron: *"i'm aiming for consistency throughout. not
            building one method for mobile and another method for desktop the same flow should work
            for both."* Only ☰ is phone-only, because only the phone has a drawer to open. */}
        <div className="relative flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center relative">
              <img src="/FG.webp" alt="Fleet Garage" className="w-full h-full object-cover" />
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white transition-colors ${
                  isOnline ? 'bg-green-500' : 'bg-amber-500 motion-safe:animate-pulse'
                }`}
                title={isOnline ? 'Online' : 'Offline'}
              />
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">Fleet Garage</span>
            {guidesOn && (
              <button
                onClick={() => { hapticLight(); setGuideModule(activeModule); }}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer ml-0.5"
                title="Module Guide"
              >
                <span className="text-xs">i</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ActiveSessionPill activeModule={activeModule} onNavigate={handleNavigate} />
            {/* 🔍 The typing door into the SAME scan sheet (2026-09-10): plate or unit, keyboard up,
                no camera. Same card, same menu, same sighting rule — looking never counts as seen,
                only a change does. Its room came from moving the bell + avatar into the drawer. */}
            <button
              type="button"
              onClick={scanRouter.search}
              aria-label="Find a car"
              title="Find a car"
              className="text-lg leading-none px-1 cursor-pointer hover:opacity-70 transition"
            >
              🔍
            </button>
            {/* Universal scan-router — reachable from every module (the other door is the My Day
                card). Always-visible icon, not tap-to-expand: scanning is one tap, not two. */}
            <button
              type="button"
              onClick={scanRouter.scan}
              aria-label="Scan a key tag"
              title="Scan a key tag"
              className="text-lg leading-none px-1 cursor-pointer hover:opacity-70 transition"
            >
              📷
            </button>
            {/* Divider + gap: a thumb reaching for 📷 used to clip the notification bell beside
                it, so the constant-tap scan stays separated from its neighbour — now ☰, which is
                rightmost since 2026-09-10 (the top-left corner was a reach in a wrist brace). The
                bell and avatar moved into the drawer: one placement at every size. */}
            <div className="md:hidden w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" aria-hidden="true" />
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <OfflineSyncBanner />

        {/* ⭐⭐ THE PAGE FRAME LIVES HERE, so a screen cannot forget it.
            Aaron on PROD at 412px, 2026-09-06: *"My Day, Holds, Movement Log, pretty much all have
            the same amount of breathing room on the left and right side of the screen… but fleet
            view breaks things going end to end, is this by choice?"* It was not — it was DRIFT.
            Eight views each carried their own copy of `w-full max-w-3xl mx-auto px-4`; Fleet,
            Audits, Issue Log, Outbound Manifest and Schedule never got one. A convention held by
            copy-paste is a convention that eventually is not held.

            ⚠️ HORIZONTAL ONLY. Vertical padding stays with each view because it legitimately
            varies (py-5, py-6, py-8, py-16 for a centred empty state), and hoisting it would make
            every view do arithmetic against this one. His complaint was the left and right. */}
        <div ref={contentRef} className="flex-1 overflow-auto">
          <div className="w-full max-w-3xl mx-auto px-4">
            {children}
          </div>
        </div>

        <BuildStamp />
      </div>


      {guideModule !== null && (
        <ModuleGuideModal
          initialModule={guideModule}
          onClose={() => setGuideModule(null)}
        />
      )}

      {pendingApprovalEntryId && (
        <OffStdEditApprovalSheet
          entryId={pendingApprovalEntryId}
          onClose={() => setPendingApprovalEntryId(null)}
        />
      )}

      {pendingBackdateId && (
        <BackdateApprovalSheet
          entryId={pendingBackdateId}
          onClose={() => setPendingBackdateId(null)}
        />
      )}

      {pendingVehicleEditId && (
        <VehicleEditApprovalSheet
          vehicleId={pendingVehicleEditId}
          onClose={() => setPendingVehicleEditId(null)}
        />
      )}
    </div>
  );
}
