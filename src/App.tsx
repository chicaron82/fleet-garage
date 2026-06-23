import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { VehicleHoldProvider } from './context/VehicleHoldContext';
import { WashbayProvider } from './context/WashbayContext';
import { IssueProvider } from './context/IssueContext';
import { LostFoundProvider } from './context/LostFoundContext';
import { FleetBalanceProvider } from './context/FleetBalanceContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { ActiveSessionsProvider } from './context/ActiveSessionsContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './components/shared/LoginScreen';
import { LogoutConfirm } from './components/shared/LogoutConfirm';
import { getActiveModule, getDefaultScreenForRole, getNavItemsForRole, canAccessScreen } from './lib/navigation';
import { screenToPath, pathToScreen } from './lib/screenRouting';
import { isRealAccount } from './lib/demo-accounts';
import { AppErrorBoundary } from './components/shared/AppErrorBoundary';
import { useOfflineQueueFlush } from './hooks/useOfflineQueueFlush';
import type { Screen } from './types';

// Lazy-loaded screen components — each becomes its own chunk
const HoldsView          = lazy(() => import('./components/dashboard/HoldsView').then(m => ({ default: m.HoldsView })));
const VehicleHistory     = lazy(() => import('./components/vehicle/VehicleHistory').then(m => ({ default: m.VehicleHistory })));
const NewHoldForm        = lazy(() => import('./components/holds/NewHoldForm').then(m => ({ default: m.NewHoldForm })));
const RegisterVehicleForm = lazy(() => import('./components/vehicle/RegisterVehicleForm').then(m => ({ default: m.RegisterVehicleForm })));
const MovementLogView    = lazy(() => import('./components/movement/MovementLogView').then(m => ({ default: m.MovementLogView })));
const ScheduleScreen    = lazy(() => import('./components/schedule/ScheduleScreen').then(m => ({ default: m.ScheduleScreen })));
const MyShiftView        = lazy(() => import('./components/my-shift/MyShiftView').then(m => ({ default: m.MyShiftView })));
const LostAndFoundView   = lazy(() => import('./components/lost-and-found/LostAndFoundView').then(m => ({ default: m.LostAndFoundView })));
const CheckInView        = lazy(() => import('./components/check-in/CheckInView').then(m => ({ default: m.CheckInView })));
const AuditView          = lazy(() => import('./components/audit/AuditView').then(m => ({ default: m.AuditView })));
const AuditForm          = lazy(() => import('./components/audit/AuditForm').then(m => ({ default: m.AuditForm })));
const AnalyticsView      = lazy(() => import('./components/analytics/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const IssueLogView       = lazy(() => import('./components/issue-log/IssueLogView').then(m => ({ default: m.IssueLogView })));
const ManifestView       = lazy(() => import('./components/manifest/ManifestView').then(m => ({ default: m.ManifestView })));
const FleetMasterView    = lazy(() => import('./components/vehicle/FleetMasterView').then(m => ({ default: m.FleetMasterView })));

export default function App() {
  const { user, loading, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>(() =>
    user ? getDefaultScreenForRole(user.role, user.branchId, !isRealAccount(user.employeeId)) : { name: 'dashboard' }
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [prevUserId, setPrevUserId] = useState(user?.id);
  const [fleetRefreshKey, setFleetRefreshKey] = useState(0);

  // Drain any queued offline writes on mount / refocus / reconnect (see hook).
  useOfflineQueueFlush();

  const navigate = useCallback((next: Screen) => {
    window.history.pushState(next, '', screenToPath(next));
    setScreen(next);
  }, []);

  // Seed the initial history entry on login (derived state — avoids setState-in-effect)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    if (user) {
      const navItems = getNavItemsForRole(user.role, user.branchId, !isRealAccount(user.employeeId));
      const rawDeepLink = window.location.pathname !== '/'
        ? pathToScreen(window.location.pathname)
        : null;
      // Reject a deep-link this user can't access (e.g. a leftover /audits URL from a
      // different account in the same tab) — it would otherwise bypass the role gate.
      const deepLinkScreen = rawDeepLink && canAccessScreen(rawDeepLink, user.role, user.branchId, !isRealAccount(user.employeeId))
        ? rawDeepLink
        : null;
      const savedModule = sessionStorage.getItem('fg_last_module') === 'fleet-garage' ? 'holds' : sessionStorage.getItem('fg_last_module');
      const savedNavItem = savedModule ? navItems.find(i => i.module === savedModule) : null;
      const targetScreen = deepLinkScreen
        ?? savedNavItem?.defaultScreen
        ?? getDefaultScreenForRole(user.role, user.branchId, !isRealAccount(user.employeeId));
      window.history.replaceState({ appRoot: true }, '', '/');
      window.history.pushState(targetScreen, '', screenToPath(targetScreen));
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
        const def = user ? getDefaultScreenForRole(user.role, user.branchId, !isRealAccount(user.employeeId)) : { name: 'dashboard' as const };
        window.history.pushState(def, '', screenToPath(def));
        setScreen(def);
        setShowLogoutConfirm(true);
      } else {
        setScreen(state as Screen);
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
  if (!canAccessScreen(screen, user.role, user.branchId, !isRealAccount(user.employeeId))) {
    const def = getDefaultScreenForRole(user.role, user.branchId, !isRealAccount(user.employeeId));
    if (screen.name !== def.name) {
      window.history.replaceState(def, '', screenToPath(def));
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
            onBack={() => navigate({ name: 'dashboard' })}
            onNewHold={(vehicleId) => navigate({ name: 'new-hold', vehicleId })}
          />
        );
      case 'new-hold':
        return (
          <NewHoldForm
            vehicleId={screen.vehicleId}
            onBack={() => navigate({ name: 'dashboard' })}
            onSuccess={(vehicleId) => {
              // If this hold came from a fresh registration, clean the history stack
              if (screen.fromRegister) {
                window.history.replaceState({ appRoot: true }, '', '/');
                window.history.pushState({ name: 'dashboard' }, '', '/');
                window.history.pushState({ name: 'vehicle', vehicleId }, '', `/vehicle/${vehicleId}`);
                setScreen({ name: 'vehicle', vehicleId });
              } else {
                navigate({ name: 'vehicle', vehicleId });
              }
            }}
            onRegisterNew={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
          />
        );
      case 'register-vehicle':
        return (
          <RegisterVehicleForm
            prefill={screen.prefill}
            returnTo={screen.fromHold ? 'hold' : 'fleet'}
            onBack={() =>
              screen.fromHold
                ? navigate({ name: 'new-hold' })
                : navigate({ name: 'dashboard' })
            }
            onSuccess={(vehicleId) => {
              if (screen.fromHold) {
                navigate({ name: 'new-hold', vehicleId, fromRegister: true });
              } else {
                setFleetRefreshKey(k => k + 1);
                navigate({ name: 'fleet-master' });
              }
            }}
          />
        );
      case 'check-in':
        return <CheckInView onFlagIssue={(vehicleId) => navigate({ name: 'new-hold', vehicleId })} />;
      case 'movement-log':
        return <MovementLogView />;
      case 'schedule':
        return <ScheduleScreen />;
      case 'my-shift':
        return <MyShiftView />;
      case 'lost-and-found':
        return <LostAndFoundView />;
      case 'audits':
        return <AuditView onNewAudit={() => navigate({ name: 'audit-form' })} />;
      case 'audit-form':
        return <AuditForm onBack={() => navigate({ name: 'audits' })} />;
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
      default:
        return (
          <HoldsView
            onSelectVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
            onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
          />
        );
    }
  };

  return (
    <ScheduleProvider>
      <VehicleHoldProvider>
        <WashbayProvider>
          <IssueProvider>
            <LostFoundProvider>
              <FleetBalanceProvider>
                <ActiveSessionsProvider>
                  <AppShell activeModule={activeModule} screenKey={JSON.stringify(screen)} onNavigate={navigate}>
                    <AppErrorBoundary>
                      <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>}>
                        {renderScreen()}
                      </Suspense>
                    </AppErrorBoundary>
                  </AppShell>
                </ActiveSessionsProvider>
              </FleetBalanceProvider>
              {showLogoutConfirm && (
                <LogoutConfirm
                  onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
                  onCancel={() => setShowLogoutConfirm(false)}
                />
              )}
            </LostFoundProvider>
          </IssueProvider>
        </WashbayProvider>
      </VehicleHoldProvider>
    </ScheduleProvider>
  );
}
