import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { DamageZoneBackfillView } from './components/holds/DamageZoneBackfillView';
import { useAuth } from './context/AuthContext';
import { VehicleHoldProvider } from './context/VehicleHoldContext';
import { WashbayProvider } from './context/WashbayContext';
import { IssueProvider } from './context/IssueContext';
import { LostFoundProvider } from './context/LostFoundContext';
import { FleetBalanceProvider } from './context/FleetBalanceContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { ActiveSessionsProvider } from './context/ActiveSessionsContext';
import { ScanRouterProvider } from './context/ScanRouterContext';
import { EffieProvider } from './context/EffieContext';
import { PendingWritesProvider } from './context/PendingWritesContext';
import { AppShell } from './components/layout/AppShell';
import { FgAssistantFab } from './components/assistant/FgAssistantFab';
import { LoginScreen } from './components/shared/LoginScreen';
import { LogoutConfirm } from './components/shared/LogoutConfirm';
import { getActiveModule, getDefaultScreenForRole, canAccessScreen, resolveLandingScreen } from './lib/navigation';
import { screenToPath, pathToScreen, backAction, depthOf, historyWrite, type HistoryDepth } from './lib/screenRouting';
import { AppErrorBoundary } from './components/shared/AppErrorBoundary';
import { useOfflineQueueFlush } from './hooks/useOfflineQueueFlush';
import { usePreferences } from './context/PreferencesContext';
import type { Screen, Module } from './types';

// Lazy-loaded screen components — each becomes its own chunk
const HoldsView          = lazy(() => import('./components/dashboard/HoldsView').then(m => ({ default: m.HoldsView })));
const MyDayView          = lazy(() => import('./components/my-day/MyDayView').then(m => ({ default: m.MyDayView })));
const VehicleHistory     = lazy(() => import('./components/vehicle/VehicleHistory').then(m => ({ default: m.VehicleHistory })));
const NewHoldForm        = lazy(() => import('./components/holds/NewHoldForm').then(m => ({ default: m.NewHoldForm })));
const RegisterVehicleForm = lazy(() => import('./components/vehicle/RegisterVehicleForm').then(m => ({ default: m.RegisterVehicleForm })));
const MovementLogView    = lazy(() => import('./components/movement/MovementLogView').then(m => ({ default: m.MovementLogView })));
const ScheduleScreen    = lazy(() => import('./components/schedule/ScheduleScreen').then(m => ({ default: m.ScheduleScreen })));
const MyShiftView        = lazy(() => import('./components/my-shift/MyShiftView').then(m => ({ default: m.MyShiftView })));
const LostAndFoundView   = lazy(() => import('./components/lost-and-found/LostAndFoundView').then(m => ({ default: m.LostAndFoundView })));
const AuditView          = lazy(() => import('./components/audit/AuditView').then(m => ({ default: m.AuditView })));
const AuditForm          = lazy(() => import('./components/audit/AuditForm').then(m => ({ default: m.AuditForm })));
const AnalyticsView      = lazy(() => import('./components/analytics/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const IssueLogView       = lazy(() => import('./components/issue-log/IssueLogView').then(m => ({ default: m.IssueLogView })));
const ManifestView       = lazy(() => import('./components/manifest/ManifestView').then(m => ({ default: m.ManifestView })));
const FleetMasterView    = lazy(() => import('./components/vehicle/FleetMasterView').then(m => ({ default: m.FleetMasterView })));
const EffieModule        = lazy(() => import('./components/assistant/EffieModule').then(m => ({ default: m.EffieModule })));

export default function App() {
  const { user, loading, logout } = useAuth();
  const { prefs } = usePreferences();
  const [screen, setScreen] = useState<Screen>(() =>
    user ? getDefaultScreenForRole(user.role, user.branchId) : { name: 'dashboard' }
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [prevUserId, setPrevUserId] = useState(user?.id);
  const [fleetRefreshKey, setFleetRefreshKey] = useState(0);

  // Drain any queued offline writes on mount / refocus / reconnect (see hook).
  useOfflineQueueFlush();

  const navigate = useCallback((next: Screen, opts?: { replace?: boolean }) => {
    // Stamp the depth so "is there anywhere to go back to" stays a readable fact across pushes,
    // pops and refreshes, instead of a counter we would have to keep in sync (see lib/screenRouting).
    //
    // ⭐ `replace` SWAPS the current entry instead of stacking on it, and keeps the SAME depth —
    // replacing does not descend. It exists for ONE-SHOT screens: a submitted register form has no
    // remaining valid action, and leaving it in the stack means "back" returns him to a form whose
    // only possible outcome is a duplicate car (Aaron, 2026-08-26).
    const { method, depth } = historyWrite(window.history.state, opts?.replace);
    const entry = { ...next, _depth: depth };
    if (method === 'replace') window.history.replaceState(entry, '', screenToPath(next));
    else window.history.pushState(entry, '', screenToPath(next));
    setScreen(next);
  }, []);

  /**
   * What "← Back" does. POPS the stack FG already maintains, so he lands in the module he came
   * from — Fleet if he came from Fleet, Holds if he came from Holds.
   *
   * ⭐ Every back button used to `navigate({ name: 'dashboard' })` instead, which PUSHED the Holds
   * dashboard. Aaron: "when i look up a car in fleet module and open it up. then hit back, i'm taken
   * to the holds module instead of back to the fleet module." It also grew the stack on every
   * back-tap, so the hardware back button then walked him forwards through screens he had left.
   *
   * The fallback is only reachable at depth 1 — a deep link or a refresh straight onto a record,
   * where there is genuinely nothing behind.
   */
  const goBack = useCallback((fallback: Screen) => {
    if (backAction(window.history.state) === 'pop') window.history.back();
    // ⚠️ The fallback REPLACES rather than pushes. Pushing it stacked the fallback on top of the
    // screen he had just backed out of, so the hardware back button walked him FORWARDS into it
    // again — verbatim the defect described above, surviving in the one branch that still pushed.
    else navigate(fallback, { replace: true });
  }, [navigate]);

  // Seed the initial history entry on login (derived state — avoids setState-in-effect)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    if (user) {
      const rawDeepLink = window.location.pathname !== '/'
        ? pathToScreen(window.location.pathname)
        : null;
      // Reject a deep-link this user can't access (e.g. a leftover /audits URL from a
      // different account in the same tab) — it would otherwise bypass the role gate.
      const deepLinkScreen = rawDeepLink && canAccessScreen(rawDeepLink, user.role, user.branchId)
        ? rawDeepLink
        : null;
      // 'fleet-garage' is the legacy id for the Holds module — remap before resolving.
      const lastModule = sessionStorage.getItem('fg_last_module');
      const savedModule = (lastModule === 'fleet-garage' ? 'holds' : lastModule) as Module | null;
      // Deep-link wins; else the landing-tab pref decides (pin My Shift vs resume last-visited).
      const targetScreen = resolveLandingScreen({
        deepLink: deepLinkScreen,
        savedModule,
        landingPref: prefs.landingTab,
        role: user.role,
        activeBranch: user.branchId,
      });
      window.history.replaceState({ appRoot: true }, '', '/');
      window.history.pushState({ ...targetScreen, _depth: 1 }, '', screenToPath(targetScreen));
      setScreen(targetScreen);
    }
  }

  // Persist active module so it survives a page refresh
  useEffect(() => {
    if (user) sessionStorage.setItem('fg_last_module', getActiveModule(screen));
  }, [screen, user]);

  // Handle Android / browser back button
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = e.state as (Screen & { appRoot?: boolean }) | null;
      if (!state || state.appRoot) {
        const def = user ? getDefaultScreenForRole(user.role, user.branchId) : { name: 'dashboard' as const };
        window.history.pushState({ ...def, _depth: 1 }, '', screenToPath(def));
        setScreen(def);
        setShowLogoutConfirm(true);
      } else {
        // Strip the depth stamp — it belongs to the history entry, not to the screen.
        const { _depth: _ignored, ...restored } = state as Screen & HistoryDepth;
        void _ignored;
        setScreen(restored as Screen);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [user]);

  if (loading) return null;
  if (!user) return <LoginScreen />;

  // Central access guard (defense-in-depth): never render a screen this user's
  // role can't reach, however it got set. The entry points are already guarded —
  // the login-restore validates the deep-link, the nav menu only shows accessible
  // items — but this is the catch-all net for any future programmatic nav or stale
  // route. Snaps to the role's default and re-renders before painting gated content.
  if (!canAccessScreen(screen, user.role, user.branchId)) {
    const def = getDefaultScreenForRole(user.role, user.branchId);
    if (screen.name !== def.name) {
      window.history.replaceState({ ...def, _depth: Math.max(depthOf(window.history.state), 1) }, '', screenToPath(def));
      setScreen(def);
    }
    return null;
  }

  const activeModule = getActiveModule(screen);

  const renderScreen = () => {
    switch (screen.name) {
      case 'vehicle':
        return (
          <VehicleHistory
            vehicleId={screen.vehicleId}
            openRepair={screen.openRepair}
            openRepairNonce={screen.openRepairNonce}
            onBack={() => goBack({ name: 'dashboard' })}
            onNewHold={(vehicleId) => navigate({ name: 'new-hold', vehicleId, fromVehicle: true })}
            cohort={screen.cohort}
            /* Stepping keeps the SAME cohort — that is the whole point: he is walking one list. */
            onOpenVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId, cohort: screen.cohort })}
          />
        );
      case 'new-hold':
        return (
          <NewHoldForm
            vehicleId={screen.vehicleId}
            prefillNonce={screen.prefillNonce}
            onBack={() => goBack({ name: 'dashboard' })}
            /* ⭐ A SUBMITTED FORM MUST LEAVE THE STACK — and the three journeys here get three
               different answers, because "back" means something different from each origin.
               Aaron, 2026-08-27: *"looked up lur212, flagged it for PM. hit back and took me to the
               form."* That was the plain flag path, which still PUSHED the vehicle record on top of
               the completed form. `08ead1b` fixed this for the register form a day earlier; this
               form has the same shape and never got it. */
            onSuccess={(vehicleId) => {
              // If this hold came from a fresh registration, clean the history stack
              if (screen.fromRegister) {
                window.history.replaceState({ appRoot: true }, '', '/');
                window.history.pushState({ name: 'dashboard', _depth: 1 }, '', '/');
                window.history.pushState({ name: 'vehicle', vehicleId, _depth: 2 }, '', `/vehicle/${vehicleId}`);
                setScreen({ name: 'vehicle', vehicleId });
              } else if (screen.fromVehicle) {
                /* He came FROM the car's record, so he is RETURNING: pop, and the record he lands on
                   already shows the hold he just made. Replacing here would put the vehicle screen at
                   two depths and his first back-tap would look like it did nothing — the exact hazard
                   the register form's own comment names. */
                goBack({ name: 'vehicle', vehicleId });
              } else {
                /* From the SCAN overlay, which is not a history entry — the form is sitting on top of
                   whatever screen he was on (My Day, usually). Popping would take him back THERE
                   rather than to the car he just flagged, so the form's entry is replaced by the
                   record instead. */
                navigate({ name: 'vehicle', vehicleId }, { replace: true });
              }
            }}
            onRegisterNew={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
          />
        );
      case 'register-vehicle':
        return (
          <RegisterVehicleForm
            prefill={screen.prefill}
            scanned={screen.scanned}
            keytagPhoto={screen.scannedPhoto}
            returnTo={screen.fromHold ? 'hold' : 'fleet'}
            onBack={() => goBack(screen.fromHold ? { name: 'new-hold' } : { name: 'fleet-master' })}
            /* ⭐ The completed form must leave the stack — the two paths are different journeys and
               get different answers. From a hold he is going FORWARD, carrying the new vehicleId
               into the hold form, so the entry is replaced. From Fleet he is RETURNING, so it pops
               — the same primitive this form's own ← Back uses one line above. (Replacing on the
               Fleet path would leave fleet-master at two depths and his first back-tap would look
               like it did nothing.) */
            onSuccess={(vehicleId) => {
              if (screen.fromHold) {
                navigate({ name: 'new-hold', vehicleId, fromRegister: true }, { replace: true });
              } else {
                setFleetRefreshKey(k => k + 1);
                goBack({ name: 'fleet-master' });
              }
            }}
          />
        );
      case 'my-day':
        return <MyDayView onNavigate={navigate} />;
      case 'movement-log':
        return <MovementLogView prefillPlate={screen.prefillPlate} prefillNonce={screen.prefillNonce} autoStart={screen.autoStart} />;
      case 'schedule':
        return <ScheduleScreen openImport={screen.openImport} />;
      case 'my-shift':
        return <MyShiftView />;
      case 'lost-and-found':
        return <LostAndFoundView prefillPlate={screen.prefillPlate} prefillNonce={screen.prefillNonce} />;
      case 'audits':
        return <AuditView onNewAudit={() => navigate({ name: 'audit-form' })} />;
      case 'audit-form':
        return <AuditForm onBack={() => goBack({ name: 'audits' })} />;
      case 'analytics':
        return <AnalyticsView onOpenVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })} />;
      case 'issue-log':
        return <IssueLogView />;
      case 'manifest':
        return <ManifestView />;
      case 'fleet-master':
        return (
          <FleetMasterView
            onNavigate={navigate}
            onRegisterNew={(prefill) => navigate({ name: 'register-vehicle', prefill })}
            refreshKey={fleetRefreshKey}
          />
        );
      case 'zone-backfill':
        return <DamageZoneBackfillView onBack={() => goBack({ name: 'dashboard' })} />;
      case 'effie':
        return <EffieModule onNavigate={navigate} />;
      default:
        return (
          <HoldsView
            onSelectVehicle={(vehicleId, cohort) => navigate({ name: 'vehicle', vehicleId, cohort })}
            onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
            onOpenZoneBackfill={() => navigate({ name: 'zone-backfill' })}
          />
        );
    }
  };

  return (
    <EffieProvider>
      <ScheduleProvider>
      <VehicleHoldProvider>
        <WashbayProvider>
          <IssueProvider>
            <LostFoundProvider>
              {/* One shared pending-writes instance: the review section, every stage producer,
                  and the My-Shift sidebar badge all read the same live count. */}
              <PendingWritesProvider>
              <FleetBalanceProvider>
                <ActiveSessionsProvider>
                  {/* Inside VehicleHoldProvider (the router resolves against the fleet) and around
                      AppShell, so BOTH entry points — the header icon and the My Day card — reach
                      the one shared overlay. */}
                  <ScanRouterProvider navigate={navigate}>
                    <AppShell activeModule={activeModule} screenKey={JSON.stringify(screen)} onNavigate={navigate}>
                      <AppErrorBoundary>
                        <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>}>
                          {renderScreen()}
                        </Suspense>
                      </AppErrorBoundary>
                    </AppShell>
                  </ScanRouterProvider>
                </ActiveSessionsProvider>
              </FleetBalanceProvider>
              {showLogoutConfirm && (
                <LogoutConfirm
                  onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
                  onCancel={() => setShowLogoutConfirm(false)}
                />
              )}
              <FgAssistantFab module={activeModule} onNavigate={navigate} />
              </PendingWritesProvider>
            </LostFoundProvider>
          </IssueProvider>
        </WashbayProvider>
      </VehicleHoldProvider>
      </ScheduleProvider>
    </EffieProvider>
  );
}
