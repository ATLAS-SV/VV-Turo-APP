import type { Booking, EarningItem, EarningType, Payout } from './types';

export const EARNING_TYPES: EarningType[] = ['trip', 'incentive', 'reimbursement', 'claim'];

export const EARNING_LABELS: Record<EarningType, string> = {
  trip: 'Trip earnings',
  incentive: 'Incentives & bonuses',
  reimbursement: 'Reimbursements',
  claim: 'Claims',
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

/** All money items: each non-canceled booking's trip earnings (counted on the trip end date) plus extras. */
export function earningItems(bookings: Booking[], extras: EarningItem[]): EarningItem[] {
  const fromBookings: EarningItem[] = bookings
    .filter((b) => !b.canceled)
    .map((b) => ({
      id: `booking-${b.id}`,
      type: 'trip',
      amount: b.earnings,
      date: b.tripEnd,
      carId: b.carId,
      reservationId: b.reservationId,
      description: `${b.guestFirstName}'s trip`,
      source: 'booking',
    }));
  return [...fromBookings, ...extras];
}

export type TypeTotals = Record<EarningType, { earned: number; upcoming: number }>;

const emptyTotals = (): TypeTotals => ({
  trip: { earned: 0, upcoming: 0 },
  incentive: { earned: 0, upcoming: 0 },
  reimbursement: { earned: 0, upcoming: 0 },
  claim: { earned: 0, upcoming: 0 },
});

export interface MonthSummary {
  month: string;
  earned: number;
  upcoming: number;
  byType: TypeTotals;
  byCar: Record<string, number>;
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
    tripCount,
    payouts: monthPayouts,
    paidOut: round(monthPayouts.reduce((s, p) => s + p.amount, 0)),
  };
}

export function monthWhen(month: string, now: Date): 'past' | 'current' | 'future' {
  const cur = monthKey(now);
  return month === cur ? 'current' : month < cur ? 'past' : 'future';
}
