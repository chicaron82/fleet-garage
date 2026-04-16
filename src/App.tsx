import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { GarageProvider } from './context/GarageContext';
import { AppShell } from './components/layout/AppShell';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { VehicleHistory } from './components/VehicleHistory';
import { NewHoldForm } from './components/NewHoldForm';
import { RegisterVehicleForm } from './components/RegisterVehicleForm';
import { TripsView } from './components/TripsView';
import { InventoryView } from './components/InventoryView';
import { LostAndFoundView } from './components/LostAndFoundView';
import { CheckInView } from './components/CheckInView';
import { LogoutConfirm } from './components/LogoutConfirm';
import { getActiveModule, getDefaultScreenForRole } from './lib/navigation';
import type { Screen } from './types';

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
      const defaultScreen = getDefaultScreenForRole(user.role);
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
        const def = user ? getDefaultScreenForRole(user.role) : { name: 'dashboard' as const };
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
            onSuccess={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
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
            onSuccess={(vehicleId) => navigate({ name: 'new-hold', vehicleId })}
          />
        );
      case 'check-in':
        return <CheckInView />;
      case 'trips':
        return <TripsView />;
      case 'inventory':
        return <InventoryView />;
      case 'lost-and-found':
        return <LostAndFoundView />;
      default:
        return (
          <Dashboard
            onSelectVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
            onNewHold={() => navigate({ name: 'new-hold' })}
            onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', prefill })}
          />
        );
    }
  };

  return (
    <GarageProvider>
      <AppShell activeModule={activeModule} onNavigate={navigate}>
        {renderScreen()}
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
