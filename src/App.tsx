import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { VehicleHistory } from './components/VehicleHistory';
import { NewHoldForm } from './components/NewHoldForm';
import { RegisterVehicleForm } from './components/RegisterVehicleForm';

export type Screen =
  | { name: 'dashboard' }
  | { name: 'vehicle'; vehicleId: string }
  | { name: 'new-hold'; vehicleId?: string }
  | { name: 'register-vehicle'; fromHold?: boolean; prefill?: string };

export default function App() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Push a history entry whenever screen changes so Android back has somewhere to pop to
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
        // At dashboard — push back so we stay, show logout confirm
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

  if (screen.name === 'vehicle') {
    return (
      <>
        <VehicleHistory
          vehicleId={screen.vehicleId}
          onBack={() => navigate({ name: 'dashboard' })}
          onNewHold={(vehicleId) => navigate({ name: 'new-hold', vehicleId })}
        />
        {showLogoutConfirm && <LogoutConfirm onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
      </>
    );
  }

  if (screen.name === 'new-hold') {
    return (
      <>
        <NewHoldForm
          vehicleId={screen.vehicleId}
          onBack={() => navigate({ name: 'dashboard' })}
          onSuccess={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
          onRegisterNew={(prefill) => navigate({ name: 'register-vehicle', fromHold: true, prefill })}
        />
        {showLogoutConfirm && <LogoutConfirm onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
      </>
    );
  }

  if (screen.name === 'register-vehicle') {
    return (
      <>
        <RegisterVehicleForm
          prefill={screen.prefill}
          onBack={() =>
            screen.fromHold
              ? navigate({ name: 'new-hold' })
              : navigate({ name: 'dashboard' })
          }
          onSuccess={(vehicleId) => navigate({ name: 'new-hold', vehicleId })}
        />
        {showLogoutConfirm && <LogoutConfirm onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
      </>
    );
  }

  return (
    <>
      <Dashboard
        onSelectVehicle={(vehicleId) => navigate({ name: 'vehicle', vehicleId })}
        onNewHold={() => navigate({ name: 'new-hold' })}
        onRegisterAndFlag={(prefill) => navigate({ name: 'register-vehicle', prefill })}
      />
      {showLogoutConfirm && <LogoutConfirm onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
    </>
  );
}

function LogoutConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 text-base">Sign out?</h2>
          <p className="text-sm text-gray-500 mt-1">You'll need to enter your employee ID to get back in.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
