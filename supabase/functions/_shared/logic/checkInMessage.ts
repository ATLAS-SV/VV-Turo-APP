// GENERATED from src/logic/checkInMessage.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
export const DEFAULT_CHECK_IN_TEMPLATE =
  'Hi {guest}! Your {car} is ready for pickup at our lot. When you arrive, open this link and allow location access, ' +
  'and your car will unlock: {link}\n\nThe link works from {window}. Once it unlocks, start the car within {countdown} ' +
  'minutes or it will lock again (you can unlock it again from the same link).\n\nEnjoy your trip!\n— Valadon Ventures';

/** Fill in the message template. Placeholders: {guest} {car} {link} {window} {countdown}. */
export function buildCheckInMessage(
  template: string,
  v: { guest: string; car: string; link: string; window: string; countdown: number },
): string {
  return template
    .replaceAll('{guest}', v.guest)
    .replaceAll('{car}', v.car)
    .replaceAll('{link}', v.link)
    .replaceAll('{window}', v.window)
    .replaceAll('{countdown}', String(v.countdown));
}
