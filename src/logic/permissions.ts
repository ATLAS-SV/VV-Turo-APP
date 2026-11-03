import type { CarAccess, Settings, User } from './types';

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

/** An employee's car access, set per person (falls back to the old fleet-wide setting if never set). */
export function carAccessOf(user: User, settings: Settings): CarAccess {
  return user.carAccess ?? (settings.employeeUnlockScope === 'assigned' ? 'picked' : 'all');
}

/** Locking is always allowed for signed-in users; unlocking may be limited to the cars picked for them. */
export function canUnlockCar(user: User | null, carId: string, settings: Settings): boolean {
  if (!user) return false;
  if (user.role === 'executive') return true;
  if (carAccessOf(user, settings) === 'all') return true;
  return user.assignedCarIds.includes(carId);
}
