import { useAuth } from '../context/AuthContext';
import { canRelease } from '../types';
import { VSA_SCHEDULE, DRIVER_SCHEDULE } from '../data/schedule';
import { PersonalScheduleView } from './PersonalScheduleView';
import { ManagementScheduleView } from './ManagementScheduleView';

export function ScheduleView() {
  const { user } = useAuth();
  if (!user) return null;

  const isManagement = canRelease(user.role);

  if (isManagement) {
    return <ManagementScheduleView vsaSchedule={VSA_SCHEDULE} driverSchedule={DRIVER_SCHEDULE} />;
  }

  // Find user's personal schedule
  const personalSchedule = [...VSA_SCHEDULE, ...DRIVER_SCHEDULE].find(s => s.userId === user.id);

  if (!personalSchedule) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No schedule found for your user.</p>
        </div>
      </div>
    );
  }

  return <PersonalScheduleView schedule={personalSchedule} />;
}
