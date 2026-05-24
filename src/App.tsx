import { useState, useEffect, useCallback, lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import { GarageProvider } from './context/GarageContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './components/LoginScreen';
import { LogoutConfirm } from './components/LogoutConfirm';
import { getActiveModule, getDefaultScreenForRole, getNavItemsForRole } from './lib/navigation';
import type { Screen } from './types';

// Lazy-loaded screen components — each becomes its own chunk
const Dashboard          = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const VehicleHistory     = lazy(() => import('./components/VehicleHistory').then(m => ({ default: m.VehicleHistory })));
const NewHoldForm        = lazy(() => import('./components/NewHoldForm').then(m => ({ default: m.NewHoldForm })));
const RegisterVehicleForm = lazy(() => import('./components/RegisterVehicleForm').then(m => ({ default: m.RegisterVehicleForm })));
const MovementLogView    = lazy(() => import('./components/MovementLogView').then(m => ({ default: m.MovementLogView })));
const ScheduleView       = lazy(() => import('./components/ScheduleView').then(m => ({ default: m.ScheduleView })));
const InventoryView      = lazy(() => import('./components/InventoryView').then(m => ({ default: m.InventoryView })));
const LostAndFoundView   = lazy(() => import('./components/LostAndFoundView').then(m => ({ default: m.LostAndFoundView })));
const CheckInView        = lazy(() => import('./components/CheckInView').then(m => ({ default: m.CheckInView })));
const AuditDashboard     = lazy(() => import('./components/AuditDashboard').then(m => ({ default: m.AuditDashboard })));
const AuditForm          = lazy(() => import('./components/AuditForm').then(m => ({ default: m.AuditForm })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const IssueLogView       = lazy(() => import('./components/IssueLogView').then(m => ({ default: m.IssueLogView })));
const ManifestView       = lazy(() => import('./components/ManifestView').then(m => ({ default: m.ManifestView })));
const FleetMasterView    = lazy(() => import('./components/FleetMasterView').then(m => ({ default: m.FleetMasterView })));

// ── Chunk error boundary ─────────────────────────────────────────────────────
// After a new deployment, stale browsers request chunk filenames that no longer
// exist (content hashes change). This boundary catches the resulting load error
// and reloads the page once — pulling the fresh bundle silently.

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { errored: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { errored: false };
  }
  static getDerivedStateFromError() {
    return { errored: true };
  }
  componentDidCatch(error: Error) {
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError';
    if (isChunkError) {
      window.location.reload();
    }
  }
  render() {
    if (this.state.errored) return null; // reload is already in flight
    return this.props.children;
  }
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>(() =>
    user ? getDefaultScreenForRole(user.role, user.branchId) : { name: 'dashboard' }
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [prevUserId, setPrevUserId] = useState(user?.id);
  const [fleetRefreshKey, setFleetRefreshKey] = useState(0);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState(next, '');
    setScreen(next);
  }, []);

  // Seed the initial history entry on login (derived state — avoids setState-in-effect)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    if (user) {
      const navItems = getNavItemsForRole(user.role, user.branchId);
      const savedModule = sessionStorage.getItem('fg_last_module');
      const savedNavItem = savedModule ? navItems.find(i => i.module === savedModule) : null;
      const targetScreen = savedNavItem?.defaultScreen ?? getDefaultScreenForRole(user.role, user.branchId);
      window.history.replaceState({ appRoot: true }, '');
      window.history.pushState(targetScreen, '');
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
        window.history.pushState(def, '');
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
                window.history.replaceState({ appRoot: true }, '');
                window.history.pushState({ name: 'dashboard' }, '');
                window.history.pushState({ name: 'vehicle', vehicleId }, '');
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
        return <ScheduleView />;
      case 'my-shift':
        return <InventoryView />;
      case 'lost-and-found':
        return <LostAndFoundView />;
      case 'audits':
        return <AuditDashboard onNewAudit={() => navigate({ name: 'audit-form' })} />;
      case 'audit-form':
        return <AuditForm onBack={() => navigate({ name: 'audits' })} />;
      case 'analytics':
        return <AnalyticsDashboard />;
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
          <Dashboard
            onSelectVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
            onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
          />
        );
    }
  };

  return (
    <ScheduleProvider>
      <GarageProvider>
        <AppShell activeModule={activeModule} onNavigate={navigate}>
          <ChunkErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>}>
              {renderScreen()}
            </Suspense>
          </ChunkErrorBoundary>
        </AppShell>
        {showLogoutConfirm && (
          <LogoutConfirm
            onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        )}
      </GarageProvider>
    </ScheduleProvider>
  );
}
