import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { GarageProvider } from './context/GarageContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './components/LoginScreen';
import { LogoutConfirm } from './components/LogoutConfirm';
import { getActiveModule, getDefaultScreenForRole } from './lib/navigation';
import type { Screen } from './types';

// Lazy-loaded screen components — each becomes its own chunk
const Dashboard          = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const VehicleHistory     = lazy(() => import('./components/VehicleHistory').then(m => ({ default: m.VehicleHistory })));
const NewHoldForm        = lazy(() => import('./components/NewHoldForm').then(m => ({ default: m.NewHoldForm })));
const RegisterVehicleForm = lazy(() => import('./components/RegisterVehicleForm').then(m => ({ default: m.RegisterVehicleForm })));
const TripsView          = lazy(() => import('./components/TripsView').then(m => ({ default: m.TripsView })));
const ScheduleView       = lazy(() => import('./components/ScheduleView').then(m => ({ default: m.ScheduleView })));
const InventoryView      = lazy(() => import('./components/InventoryView').then(m => ({ default: m.InventoryView })));
const LostAndFoundView   = lazy(() => import('./components/LostAndFoundView').then(m => ({ default: m.LostAndFoundView })));
const CheckInView        = lazy(() => import('./components/CheckInView').then(m => ({ default: m.CheckInView })));
const AuditDashboard     = lazy(() => import('./components/AuditDashboard').then(m => ({ default: m.AuditDashboard })));
const AuditForm          = lazy(() => import('./components/AuditForm').then(m => ({ default: m.AuditForm })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const IssueLogView       = lazy(() => import('./components/IssueLogView').then(m => ({ default: m.IssueLogView })));
const ManifestView       = lazy(() => import('./components/ManifestView').then(m => ({ default: m.ManifestView })));

export default function App() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [prevUserId, setPrevUserId] = useState(user?.id);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState(next, '');
    setScreen(next);
  }, []);

  // Seed the initial history entry on login (derived state — avoids setState-in-effect)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    if (user) {
      const defaultScreen = getDefaultScreenForRole(user.role, user.branchId);
      window.history.replaceState({ appRoot: true }, '');
      window.history.pushState(defaultScreen, '');
      setScreen(defaultScreen);
    }
  }

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
            onBack={() =>
              screen.fromHold
                ? navigate({ name: 'new-hold' })
                : navigate({ name: 'dashboard' })
            }
            onSuccess={(vehicleId) => navigate({ name: 'new-hold', vehicleId, fromRegister: true })}
          />
        );
      case 'check-in':
        return <CheckInView onFlagIssue={(vehicleId) => navigate({ name: 'new-hold', vehicleId })} />;
      case 'trips':
        return <TripsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'inventory':
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
      default:
        return (
          <Dashboard
            onSelectVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
            onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', prefill })}
          />
        );
    }
  };

  return (
    <GarageProvider>
      <AppShell activeModule={activeModule} onNavigate={navigate}>
        <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>}>
          {renderScreen()}
        </Suspense>
      </AppShell>
      {showLogoutConfirm && (
        <LogoutConfirm
          onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </GarageProvider>
  );
}
