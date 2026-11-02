// GENERATED from src/logic/turoEmail.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
// Reads Turo notification emails (subject + plain-text body) into structured events.
// Pure: no network or database, so it runs in the app, the server, and tests alike.
// Formats are based on real Turo emails (Oct–Nov 2026).

export const TURO_TIME_ZONE = 'America/Los_Angeles';

export interface TripFields {
  reservationId: string;
  guestFirstName: string;
  /** "Lexus TX" — matched to a car by make + model. */
  carLabel: string;
  carYear: number | null;
  tripStart: string; // ISO UTC
  tripEnd: string; // ISO UTC
  earnings: number | null;
  guestPhone: string | null;
  conversationUrl: string;
}

export type TuroEmail =
  | ({ kind: 'booked' } & TripFields)
  | ({ kind: 'changed' } & TripFields)
  | ({ kind: 'upcoming' } & TripFields)
  | { kind: 'canceled'; reservationId: string; guestFirstName: string; carLabel: string; reason: string | null }
  | { kind: 'payout'; amount: number }
  | { kind: 'reimbursement_invoice'; reservationId: string | null; guestFirstName: string; total: number; items: string[] }
  | { kind: 'reimbursement_paid'; guestFirstName: string }
  | { kind: 'reimbursement_no_response'; guestFirstName: string }
  | { kind: 'claim_deadline'; guestFirstName: string; carLabel: string | null; plate: string | null; incidentNumber: string | null; escalateBy: string | null; reservationId: string | null }
  | { kind: 'license_reminder'; guestFirstName: string; carLabel: string }
  | { kind: 'guest_message'; guestFirstName: string; carLabel: string; reservationId: string | null }
  | { kind: 'ignored'; reason: string };

// ---------- time zone helpers (no libraries) ----------

/** Offset in minutes of `timeZone` from UTC at the given instant (e.g. -420 for PDT). */
function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Wall-clock time in `timeZone` → UTC ISO string. Handles daylight saving. */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone = TURO_TIME_ZONE): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - tzOffsetMinutes(guess, timeZone) * 60_000;
  utc = guess - tzOffsetMinutes(utc, timeZone) * 60_000; // second pass settles DST edges
  return new Date(utc).toISOString();
}

function to24h(h: number, ampm: string) {
  const pm = ampm.toLowerCase() === 'pm';
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

/** "11/5/26 6:30 am" → ISO UTC (Turo times are local to the car). */
export function parseShortDateTime(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return zonedTimeToUtc(year, Number(m[1]), Number(m[2]), to24h(Number(m[4]), m[6]), Number(m[5]));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "Sunday, October 25, 2026 at 11:30 AM" → ISO UTC. */
export function parseLongDateTime(s: string): string | null {
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!mo) return null;
  return zonedTimeToUtc(Number(m[3]), mo, Number(m[2]), to24h(Number(m[4]), m[6]), Number(m[5]));
}

// ---------- field helpers ----------

const money = (s: string | undefined) => (s ? Number(s.replace(/[$,]/g, '')) : null);
const first = (re: RegExp, text: string) => text.match(re)?.[1]?.trim() ?? null;
const clean = (s: string) => s.replace(/[’‘]/g, "'").replace(/\r/g, '');

function tripFields(subject: string, text: string): TripFields | null {
  const reservationId = first(/Reservation ID #(\d+)/, text);
  const startRaw = first(/Trip start:\s*([^\n]+)/i, text);
  const endRaw = first(/Trip end:\s*([^\n]+)/i, text);
  const carLine = text.match(/^\s*([A-Za-z][A-Za-z0-9 \-]+?)\s+((?:19|20)\d{2})\s*$/m); // "Lexus TX 2026"
  const guest = first(/(?:booked|requested) by ([^\n]+)/i, text) ?? first(/^([^']+?)'s trip/i, subject) ?? first(/^(.+?) has/i, subject);
  const carFromSubject = first(/your ([^!(\n]+?)(?:\s*\(\d+\))?(?: is booked!?|$)/i, subject);
  if (!reservationId || !startRaw || !endRaw || !guest) return null;
  const tripStart = parseShortDateTime(startRaw);
  const tripEnd = parseShortDateTime(endRaw);
  if (!tripStart || !tripEnd) return null;
  return {
    reservationId,
    guestFirstName: guest.split(' ')[0],
    carLabel: (carLine?.[1] ?? carFromSubject ?? '').trim(),
    carYear: carLine ? Number(carLine[2]) : null,
    tripStart,
    tripEnd,
    earnings: money(first(/You earn:\s*(\$[\d,]+(?:\.\d{2})?)/i, text) ?? first(/You['’]ll earn (\$[\d,]+(?:\.\d{2})?)/i, text) ?? undefined),
    guestPhone: first(/(\(\d{3}\)\s*\d{3}-\d{4})/, text),
    conversationUrl: `https://turo.com/us/en/reservation/${reservationId}/messages`,
  };
}

// ---------- main parser ----------

export function parseTuroEmail(subjectRaw: string, bodyRaw: string): TuroEmail {
  const subject = clean(subjectRaw).trim();
  const text = clean(bodyRaw);

  if (/ is booked!?$/i.test(subject) || /has an upcoming trip/i.test(subject) || /has changed their trip/i.test(subject)) {
    const f = tripFields(subject, text);
    if (!f) return { kind: 'ignored', reason: 'trip email missing fields' };
    const kind = /changed/i.test(subject) ? 'changed' : /upcoming/i.test(subject) ? 'upcoming' : 'booked';
    return { kind, ...f };
  }

  if (/has canceled their trip/i.test(subject) || /trip has been canceled/i.test(subject)) {
    const reservationId = first(/Reservation ID #(\d+)/, text) ?? first(/reservation\/(\d+)/, text);
    if (!reservationId) return { kind: 'ignored', reason: 'cancellation without reservation ID' };
    const reason = text.match(/details\.\s*\n+\s*([^\n]+)\n/)?.[1]?.trim() ?? null;
    return {
      kind: 'canceled',
      reservationId,
      guestFirstName: first(/^(\S+) has canceled/i, subject) ?? '',
      carLabel: first(/your (.+)$/i, subject) ?? '',
      reason: reason && !/^Reply/i.test(reason) ? reason : null,
    };
  }

  if (/earnings are on the way/i.test(subject)) {
    const amount = money(first(/earnings payment of (\$[\d,]+(?:\.\d{2})?)/i, text) ?? undefined);
    return amount === null ? { kind: 'ignored', reason: 'payout without amount' } : { kind: 'payout', amount };
  }

  if (/^Reimbursement invoice$/i.test(subject)) {
    const total = money(first(/Total charge\s*-\s*(\$[\d,]+(?:\.\d{2})?)/i, text) ?? undefined);
    if (total === null) return { kind: 'ignored', reason: 'invoice without total' };
    const items = [...text.matchAll(/^\s*([A-Za-z][A-Za-z ]+?)\s+-\s+\$[\d,.]+\s*$/gm)].map((m) => m[1]).filter((n) => !/^Total charge$/i.test(n));
    return {
      kind: 'reimbursement_invoice',
      reservationId: first(/reservation\/(\d+)\/invoice/i, text),
      guestFirstName: first(/sent to ([^,\n]+),/i, text) ?? '',
      total,
      items,
    };
  }

  if (/has been charged for your reimbursement invoice/i.test(subject)) {
    return { kind: 'reimbursement_paid', guestFirstName: first(/^(.+?) has been charged/i, subject) ?? '' };
  }
  if (/has not responded to your reimbursement invoice/i.test(subject)) {
    return { kind: 'reimbursement_no_response', guestFirstName: first(/^(.+?) has not responded/i, subject) ?? '' };
  }

  if (/left to resolve directly with/i.test(subject)) {
    const carLine = text.match(/^\s*([A-Za-z][A-Za-z0-9 \-]+?)\s+((?:19|20)\d{2})\s*$/m);
    return {
      kind: 'claim_deadline',
      guestFirstName: first(/resolve directly with (.+)$/i, subject) ?? '',
      carLabel: carLine?.[1]?.trim() ?? null,
      plate: first(/License plate:\s*(\S+)/i, text),
      incidentNumber: first(/Incident number:\s*(\d+)/i, text),
      escalateBy: parseLongDateTime(first(/claim with Turo by ([^.\n]+)/i, text) ?? ''),
      reservationId: first(/reservation\/(\d+)/, text),
    };
  }

  if (/still need to confirm your guest's license/i.test(subject)) {
    const m = text.match(/before (.+?)'s trip with your (.+?) begins/i);
    return m ? { kind: 'license_reminder', guestFirstName: m[1], carLabel: m[2] } : { kind: 'ignored', reason: 'license reminder without guest' };
  }

  if (/has sent you a message about your/i.test(subject)) {
    return {
      kind: 'guest_message',
      guestFirstName: first(/^(.+?) has sent you/i, subject) ?? '',
      carLabel: first(/about your (.+)$/i, subject) ?? '',
      reservationId: first(/reservation\/(\d+)/, text),
    };
  }

  return { kind: 'ignored', reason: `not handled: ${subject.slice(0, 60)}` };
}

/** Match "Lexus TX" / "2026 BMW 3 Series" to one of our cars. */
export function matchCarId(cars: { id: string; make: string; model: string }[], label: string | null): string | null {
  if (!label) return null;
  const l = label.toLowerCase();
  const hit = cars.find((c) => l.includes(c.make.toLowerCase()) && l.includes(c.model.toLowerCase()));
  return hit?.id ?? null;
}
