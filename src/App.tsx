import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { GarageProvider } from './context/GarageContext';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { VehicleHistory } from './components/VehicleHistory';
import { NewHoldForm } from './components/NewHoldForm';
import { RegisterVehicleForm } from './components/RegisterVehicleForm';
import { LogoutConfirm } from './components/LogoutConfirm';

export type Screen =
  | { name: 'dashboard' }
  | { name: 'vehicle'; vehicleId: string }
  | { name: 'new-hold'; vehicleId?: string }
  | { name: 'register-vehicle'; fromHold?: boolean; prefill?: string };

export default function App() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navigate = useCallback((next: Screen) => {
    window.history.pushState(next, '');
    setScreen(next);
  }, []);

  // Seed the initial history entry on mount / login
  useEffect(() => {
    if (user) {
      window.history.replaceState({ name: 'dashboard' }, '');
      setScreen({ name: 'dashboard' });
    }
  }, [user]);

  // Handle Android / browser back button
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = e.state as Screen | null;
      if (!state || state.name === 'dashboard') {
        window.history.pushState({ name: 'dashboard' }, '');
        setScreen({ name: 'dashboard' });
        setShowLogoutConfirm(true);
      } else {
        setScreen(state);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  if (!user) return <LoginScreen />;

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
      {renderScreen()}
      {showLogoutConfirm && (
        <LogoutConfirm
          onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </GarageProvider>
  );
}
