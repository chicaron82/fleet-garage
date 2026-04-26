const fs = require('fs');

let mockTs = fs.readFileSync('src/data/mock.ts', 'utf8');

// 1. Add BRANCH_CONFIGS
const branchConfigs = `
import type { User, Vehicle, Hold, BranchConfig, BranchId } from '../types';

// ── Branch Configs ────────────────────────────────────────────────────────────
export const BRANCH_CONFIGS: Record<BranchId, BranchConfig> = {
  'YWG': { id: 'YWG', name: 'Airport (YWG)', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule'] },
  'YWG-South': { id: 'YWG-South', name: 'Neighborhood (South)', enabledModules: ['fleet-garage', 'check-in', 'trips'] },
  'ALL': { id: 'ALL', name: 'All Branches', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule'] }
};
`;
mockTs = mockTs.replace(`import type { User, Vehicle, Hold } from '../types';`, branchConfigs);

// 2. Add branchId to users
mockTs = mockTs.replace(`{ id: 'u1', employeeId: '331965',  name: 'Aaron S.',    role: 'VSA',                password: '!Bananarama1982' },`, `{ id: 'u1', employeeId: '331965',  name: 'Aaron S.',    role: 'VSA',                password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u2', employeeId: 'VSA-002', name: 'DiZee',       role: 'Lead VSA',           password: '!Bananarama1982' },`, `{ id: 'u2', employeeId: 'VSA-002', name: 'DiZee',       role: 'Lead VSA',           password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u3', employeeId: 'VSA-003', name: 'Belle',       role: 'VSA',                password: '!Bananarama1982' },`, `{ id: 'u3', employeeId: 'VSA-003', name: 'Belle',       role: 'VSA',                password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u4', employeeId: 'CSR-001', name: 'CoZee',       role: 'CSR',                password: '!Bananarama1982' },`, `{ id: 'u4', employeeId: 'CSR-001', name: 'CoZee',       role: 'CSR',                password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u5', employeeId: 'HIR-001', name: 'Tori',        role: 'HIR',                password: '!Bananarama1982' },`, `{ id: 'u5', employeeId: 'HIR-001', name: 'Tori',        role: 'Branch Manager',     password: '!Bananarama1982', branchId: 'YWG-South' },`);
mockTs = mockTs.replace(`{ id: 'u6', employeeId: 'MGR-001', name: 'ZeeRah',      role: 'Branch Manager',     password: '!Bananarama1982' },`, `{ id: 'u6', employeeId: 'MGR-001', name: 'ZeeRah',      role: 'Branch Manager',     password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u7', employeeId: 'OPS-001', name: 'Zee',         role: 'Operations Manager', password: '!Bananarama1982' },`, `{ id: 'u7', employeeId: 'OPS-001', name: 'Zee',         role: 'Operations Manager', password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u8', employeeId: 'DRV-001', name: 'GenZee',      role: 'Driver',             password: '!Bananarama1982' },`, `{ id: 'u8', employeeId: 'DRV-001', name: 'GenZee',      role: 'Driver',             password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u9', employeeId: 'DRV-002', name: 'ZeeDric',     role: 'Driver',             password: '!Bananarama1982' },`, `{ id: 'u9', employeeId: 'DRV-002', name: 'ZeeDric',     role: 'Driver',             password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u10', employeeId: 'VSA-004', name: 'PerplexiZee', role: 'VSA',               password: '!Bananarama1982' },`, `{ id: 'u10', employeeId: 'VSA-004', name: 'PerplexiZee', role: 'VSA',               password: '!Bananarama1982', branchId: 'YWG' },`);
mockTs = mockTs.replace(`{ id: 'u11', employeeId: '256163',  name: 'Geoff N.',    role: 'Lead VSA',           password: '!Bananarama1982' },`, `{ id: 'u11', employeeId: '256163',  name: 'Geoff N.',    role: 'VSA',                password: '!Bananarama1982', branchId: 'YWG-South' },`);
mockTs = mockTs.replace(`{ id: 'u12', employeeId: '300210',  name: 'Ray T.',      role: 'VSA',               password: '!Bananarama1982' },`, `{ id: 'u12', employeeId: '300210',  name: 'Ray T.',      role: 'VSA',               password: '!Bananarama1982', branchId: 'YWG' },\n  { id: 'u13', employeeId: 'BOSS',    name: 'Big Boss',    role: 'City Manager',       password: '!Bananarama1982', branchId: 'ALL' },`);

// 3. Add branchId to vehicles and holds
mockTs = mockTs.replace(/status: '(.+)'/g, "status: '$1',\n    branchId: 'YWG'");
// Let's make v4 and v5 YWG-South
mockTs = mockTs.replace(/id: 'v4',([\s\S]*?)branchId: 'YWG'/g, "id: 'v4',$1branchId: 'YWG-South'");
mockTs = mockTs.replace(/id: 'v5',([\s\S]*?)branchId: 'YWG'/g, "id: 'v5',$1branchId: 'YWG-South'");

// Holds
mockTs = mockTs.replace(/status: '(.+)',(\s*linkedHoldId|\s*release|\s*repair|\s*})/g, "status: '$1',\n    branchId: 'YWG',$2");
mockTs = mockTs.replace(/id: 'h2',([\s\S]*?)branchId: 'YWG'/g, "id: 'h2',$1branchId: 'YWG-South'");

fs.writeFileSync('src/data/mock.ts', mockTs);

// 4. Update trips.ts
let tripsTs = fs.readFileSync('src/data/trips.ts', 'utf8');
tripsTs = tripsTs.replace(/condition: '(.+)',/g, "condition: '$1',\n    branchId: 'YWG',");
// A few don't have condition
tripsTs = tripsTs.replace(/fuelOnArrival: '(.+)',\n  }/g, "fuelOnArrival: '$1',\n    branchId: 'YWG',\n  }");
tripsTs = tripsTs.replace(/notes: '(.+)',\n  }/g, "notes: '$1',\n    branchId: 'YWG',\n  }");

fs.writeFileSync('src/data/trips.ts', tripsTs);

console.log('Mock data updated');
