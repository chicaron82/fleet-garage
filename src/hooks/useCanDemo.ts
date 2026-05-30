import { useAuth } from '../context/AuthContext';
import { isRealAccount } from '../lib/demo-accounts';

/**
 * Whether to expose the demo/live toggle for the current user. Real production
 * accounts only ever see live data; demo personas keep the toggle.
 */
export function useCanDemo(): boolean {
  const { user } = useAuth();
  return !isRealAccount(user?.employeeId);
}
