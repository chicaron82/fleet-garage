import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import { BuildStamp } from './BuildStamp';
import { UserProfileMenu } from '../shared/UserProfileMenu';
import { ModuleGuideModal } from '../shared/ModuleGuideModal';
import { usePreferences } from '../../context/PreferencesContext';
import { NotificationBell } from '../shared/NotificationBell';
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
          at desktop, which is the only thing that actually fixes it. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 max-md:transition-transform duration-200 md:static ${
          sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        }`}
      >
        <Sidebar
          activeModule={activeModule}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
          onShowGuide={guidesOn ? setGuideModule : undefined}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
            <ActiveSessionPill variant="header" activeModule={activeModule} onNavigate={handleNavigate} />
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
            {/* Divider + gap: 📷 scan is the high-frequency action; the bell/profile are
                occasional. A thumb reaching for scan kept clipping the notification bell, so
                separate the constant-tap action from the notifications/identity cluster. */}
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" aria-hidden="true" />
            <NotificationBell onNavigate={handleNavigate} onOffStdEditApproval={setPendingApprovalEntryId} onBackdateApproval={setPendingBackdateId} onVehicleEditApproval={setPendingVehicleEditId} />
            <UserProfileMenu />
          </div>
        </div>

        <OfflineSyncBanner />

        <div ref={contentRef} className="flex-1 overflow-auto">
          {children}
        </div>

        <BuildStamp />
      </div>

      <ActiveSessionPill variant="overlay" activeModule={activeModule} onNavigate={handleNavigate} />

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
