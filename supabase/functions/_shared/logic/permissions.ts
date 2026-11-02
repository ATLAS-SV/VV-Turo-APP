// GENERATED from src/logic/permissions.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import type { Settings, User } from './types.ts';

export type Capability =
  | 'editSettings'
  | 'manageTeam'
  | 'viewEarnings'
  | 'viewGuestDetails'
  | 'viewAllHours'
  | 'viewActivityLog';

const EXECUTIVE_ONLY: Capability[] = [
  'editSettings',
  'manageTeam',
  'viewEarnings',
  'viewGuestDetails',
  'viewAllHours',
  'viewActivityLog',
];

export function can(user: User | null, capability: Capability): boolean {
  if (!user) return false;
  if (user.role === 'executive') return true;
  return !EXECUTIVE_ONLY.includes(capability);
}

/** Locking is always allowed for signed-in users; unlocking may be limited to assigned cars. */
export function canUnlockCar(user: User | null, carId: string, settings: Settings): boolean {
  if (!user) return false;
  if (user.role === 'executive') return true;
  if (settings.employeeUnlockScope === 'all') return true;
  return user.assignedCarIds.includes(carId);
}
