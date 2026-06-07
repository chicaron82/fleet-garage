// Shared role-guard utilities for analytics components

export const COMPANY_STANDARD = 3.0;

export function canEnterFleetBalance(role: string): boolean {
  return ['Branch Manager', 'Operations Manager', 'Lead VSA'].includes(role);
}

export const MGMT_ROLES = ['Branch Manager', 'Operations Manager', 'City Manager'];
export function isManagement(role: string): boolean {
  return MGMT_ROLES.includes(role);
}
