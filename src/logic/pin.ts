export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
/** Wrong attempts allowed before the app locks. */
export const MAX_PIN_ATTEMPTS = 5;
const BASE_LOCKOUT_MINUTES = 5;
const MAX_LOCKOUT_MINUTES = 60;

export interface PinLockout {
  failedAttempts: number;
  lockedUntil: string | null;
  /** How many lockouts in a row; each one doubles the wait. */
  lockouts: number;
}

export const NO_LOCKOUT: PinLockout = { failedAttempts: 0, lockedUntil: null, lockouts: 0 };

export function validatePinFormat(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'PIN must be digits only.';
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return `PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits.`;
  }
  if (/^(\d)\1+$/.test(pin)) return 'PIN can’t be all the same digit.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    return 'PIN can’t be a straight sequence like 1234.';
  }
  return null;
}

export function lockedUntil(state: PinLockout, now: Date): Date | null {
  if (!state.lockedUntil) return null;
  const until = new Date(state.lockedUntil);
  return until.getTime() > now.getTime() ? until : null;
}

export function registerFailure(state: PinLockout, now: Date): PinLockout {
  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts < MAX_PIN_ATTEMPTS) return { ...state, failedAttempts };
  const minutes = Math.min(BASE_LOCKOUT_MINUTES * 2 ** state.lockouts, MAX_LOCKOUT_MINUTES);
  return {
    failedAttempts: 0,
    lockouts: state.lockouts + 1,
    lockedUntil: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}

export function attemptsLeft(state: PinLockout): number {
  return MAX_PIN_ATTEMPTS - state.failedAttempts;
}
