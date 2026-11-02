// GENERATED from src/logic/money.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import type { Booking, EarningItem, EarningType, Payout } from './types.ts';

/** Types that count toward earnings (money that reaches the account). Missed earnings are tracked separately. */
export const EARNING_TYPES: EarningType[] = ['trip', 'incentive', 'reimbursement'];

export const EARNING_LABELS: Record<EarningType, string> = {
  trip: 'Trip earnings',
  incentive: 'Incentives',
  reimbursement: 'Reimbursements',
  missed: 'Missed earnings',
};

/** "YYYY-MM" in local time. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthLabel(ym: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return style === 'long'
    ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short' });
}

/** All money items: each booking's trip earnings (counted on the trip end date) plus extras. */
export function earningItems(bookings: Booking[], extras: EarningItem[]): EarningItem[] {
  // Canceled bookings become missed earnings, counted on the trip start date.
  const fromBookings: EarningItem[] = bookings.map((b) => ({
    id: `booking-${b.id}`,
    type: b.canceled ? 'missed' : 'trip',
    amount: b.earnings,
    date: b.canceled ? b.tripStart : b.tripEnd,
    carId: b.carId,
    reservationId: b.reservationId,
    description: b.canceled ? `${b.guestFirstName}'s trip (canceled)` : `${b.guestFirstName}'s trip`,
    source: 'booking',
  }));
  return [...fromBookings, ...extras];
}

export type TypeTotals = Record<EarningType, { earned: number; upcoming: number }>;

const emptyTotals = (): TypeTotals => ({
  trip: { earned: 0, upcoming: 0 },
  incentive: { earned: 0, upcoming: 0 },
  reimbursement: { earned: 0, upcoming: 0 },
  missed: { earned: 0, upcoming: 0 },
});

export interface MonthSummary {
  month: string;
  earned: number;
  upcoming: number;
  byType: TypeTotals;
  byCar: Record<string, number>;
  /** Money that never reached you this month (canceled trips etc.). Not included in earned/upcoming. */
  missed: number;
  tripCount: number;
  payouts: Payout[];
  paidOut: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Earned = already happened (date ≤ now). Upcoming = still in the future. */
export function summarizeMonth(items: EarningItem[], payouts: Payout[], month: string, now: Date): MonthSummary {
  const byType = emptyTotals();
  const byCar: Record<string, number> = {};
  let tripCount = 0;
  for (const it of items) {
    if (monthKey(new Date(it.date)) !== month) continue;
    const bucket = Date.parse(it.date) <= now.getTime() ? 'earned' : 'upcoming';
    byType[it.type][bucket] = round(byType[it.type][bucket] + it.amount);
    if (it.type === 'missed') continue; // shown on its own, not part of earnings
    if (it.carId) byCar[it.carId] = round((byCar[it.carId] ?? 0) + it.amount);
    if (it.type === 'trip') tripCount++;
  }
  const monthPayouts = payouts
    .filter((p) => monthKey(new Date(p.sentAt)) === month)
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  return {
    month,
    earned: round(EARNING_TYPES.reduce((s, t) => s + byType[t].earned, 0)),
    upcoming: round(EARNING_TYPES.reduce((s, t) => s + byType[t].upcoming, 0)),
    byType,
    byCar,
    missed: round(byType.missed.earned + byType.missed.upcoming),
    tripCount,
    payouts: monthPayouts,
    paidOut: round(monthPayouts.reduce((s, p) => s + p.amount, 0)),
  };
}

export function monthWhen(month: string, now: Date): 'past' | 'current' | 'future' {
  const cur = monthKey(now);
  return month === cur ? 'current' : month < cur ? 'past' : 'future';
}
