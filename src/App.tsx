import { useState } from 'react';
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
  | { name: 'register-vehicle'; fromHold?: boolean };

export default function App() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });

  if (!user) return <LoginScreen />;

  if (screen.name === 'vehicle') {
    return (
      <VehicleHistory
        vehicleId={screen.vehicleId}
        onBack={() => setScreen({ name: 'dashboard' })}
        onNewHold={(vehicleId) => setScreen({ name: 'new-hold', vehicleId })}
      />
    );
  }

  if (screen.name === 'new-hold') {
    return (
      <NewHoldForm
        vehicleId={screen.vehicleId}
        onBack={() => setScreen({ name: 'dashboard' })}
        onSuccess={(vehicleId) => setScreen({ name: 'vehicle', vehicleId })}
        onRegisterNew={() => setScreen({ name: 'register-vehicle', fromHold: true })}
      />
    );
  }

  if (screen.name === 'register-vehicle') {
    return (
      <RegisterVehicleForm
        onBack={() =>
          screen.fromHold
            ? setScreen({ name: 'new-hold' })
            : setScreen({ name: 'dashboard' })
        }
        onSuccess={(vehicleId) => setScreen({ name: 'new-hold', vehicleId })}
      />
    );
  }

  return (
    <Dashboard
      onSelectVehicle={(vehicleId) => setScreen({ name: 'vehicle', vehicleId })}
      onNewHold={() => setScreen({ name: 'new-hold' })}
      onRegisterAndFlag={() => setScreen({ name: 'register-vehicle' })}
    />
  );
}
