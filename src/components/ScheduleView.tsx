import { ScheduleProvider } from '../context/ScheduleContext';
import { ScheduleScreen } from './schedule/ScheduleScreen';

export function ScheduleView() {
  return (
    <ScheduleProvider>
      <ScheduleScreen />
    </ScheduleProvider>
  );
}
