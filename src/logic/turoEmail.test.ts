// Fixtures copy the layout of real Turo emails; names, phones and IDs are made up.
import { describe, expect, it } from 'vitest';
import { matchCarId, parseShortDateTime, parseTuroEmail, zonedTimeToUtc } from './turoEmail';

const BOOKED = `Alex’s trip is booked.

    Cha-ching! Alex’s trip with your Lexus TX is booked from Thursday, November 5, 2026, 6:30 AM to Tuesday, November 10, 2026, 1:00 PM.

You’ll earn $507.83.

    Lexus TX 2026

            booked by Alex

            Trip start: 11/5/26 6:30 am
        Trip end: 11/10/26 1:00 pm

            You earn: $507.83
        Mileage included: 900 miles
            Alex
                    (555) 010-2066

            Reservation ID #11112222

Send Alex a message: https://turo.com/reservation/11112222`;

const CHANGED = `Blake has changed their trip

Here’s what Blake changed:

-
    New trip end on Sun, Oct 25 7:30 AM

    Your earnings won’t change.

    Genesis GV70 2026

            booked by Blake

            Trip start: 10/22/26 9:00 PM
        Trip end: 10/25/26 7:30 AM

            You earn: $204.28
            Blake
                    (555) 010-8550

            Reservation ID #33334444`;

const CANCELED = `Casey has canceled their trip

Casey has canceled this trip with your Genesis GV70

We’re sorry things didn’t work out. Because Casey canceled with sufficient notice, Casey won’t be charged, and you won’t receive any payment. Please see our cancellation policy <https://turo.com/policies/cancellation> for more details.

    Wrong airport

            Reply https://turo.com/us/en/reservation/55556666/messages

    Genesis GV70 2026

            requested by Casey

            Trip start: 11/17/26 7:30 PM
        Trip end: 11/20/26 12:00 PM

            Reservation ID #55556666`;

const PAYOUT = `You’ve been paid

Cha-ching! We’ve sent your earnings payment of $684.32.

It should appear in your account within three business days.`;

const INVOICE = `Reimbursement invoice

The reimbursement invoice has been sent to Drew, who has until October 27 at 4:30 PM to pay or dispute the charges.

View Invoice (https://turo.com/reservation/77778888/invoice-hub?invoiceId=1)

    2026 BMW 3 Series
    Hosted by Sebastian

    Incidental charges

            Refueling - $31.22
        Refueling costs can be charged for missing fuel, plus a $10.00 convenience fee.
            Refueling convenience fee - $10.00

            Total charge - $41.22`;

const CLAIM = `Reminder — 7 days left to resolve directly with Emery

Lexus TX 2026

License plate: 0TEST00

Incident number: 1234567

If you haven’t been able to come to an agreement, you can escalate the issue and file a claim with Turo by Sunday, October 25, 2026 at 11:30 AM. Simply reply to the claims confirmation email.

Message guest: https://turo.com/us/en/reservation/99990000/messages`;

const LICENSE = `You still need to confirm your guest’s license
You’ll need to complete this before Finley’s trip with your Genesis GV70 begins.
Open the Turo mobile app to confirm they have a current license with them.`;

const CARS = [
  { id: 'gv70', make: 'Genesis', model: 'GV70' },
  { id: 'tx', make: 'Lexus', model: 'TX' },
  { id: 'bmw3', make: 'BMW', model: '3 Series' },
  { id: 'rogue', make: 'Nissan', model: 'Rogue' },
];

describe('Turo email reader', () => {
  it('converts Turo local times (Pacific) to UTC, across daylight saving', () => {
    expect(zonedTimeToUtc(2026, 7, 1, 12, 0)).toBe('2026-07-01T19:00:00.000Z'); // PDT, UTC-7
    expect(zonedTimeToUtc(2026, 12, 1, 12, 0)).toBe('2026-12-01T20:00:00.000Z'); // PST, UTC-8
    expect(parseShortDateTime('11/5/26 6:30 am')).toBe('2026-11-05T14:30:00.000Z');
    expect(parseShortDateTime('10/25/26 7:30 AM')).toBe('2026-10-25T14:30:00.000Z');
  });

  it('reads a booking', () => {
    const e = parseTuroEmail('Alex’s trip with your Lexus TX is booked!', BOOKED);
    expect(e).toMatchObject({
      kind: 'booked',
      reservationId: '11112222',
      guestFirstName: 'Alex',
      carLabel: 'Lexus TX',
      carYear: 2026,
      tripStart: '2026-11-05T14:30:00.000Z',
      tripEnd: '2026-11-10T21:00:00.000Z',
      earnings: 507.83,
      guestPhone: '(555) 010-2066',
    });
    if (e.kind === 'booked') expect(matchCarId(CARS, e.carLabel)).toBe('tx');
  });

  it('reads a trip change and an upcoming-trip reminder', () => {
    expect(parseTuroEmail('Blake has changed their trip with your Genesis GV70 (33334444)', CHANGED)).toMatchObject({
      kind: 'changed',
      reservationId: '33334444',
      guestFirstName: 'Blake',
      tripEnd: '2026-10-25T14:30:00.000Z',
      earnings: 204.28,
    });
    expect(parseTuroEmail('Alex has an upcoming trip with your Lexus TX', BOOKED).kind).toBe('upcoming');
  });

  it('reads a cancellation (becomes missed earnings)', () => {
    expect(parseTuroEmail('Casey has canceled their trip with your Genesis GV70', CANCELED)).toEqual({
      kind: 'canceled',
      reservationId: '55556666',
      guestFirstName: 'Casey',
      carLabel: 'Genesis GV70',
      reason: 'Wrong airport',
    });
  });

  it('reads payouts and reimbursements', () => {
    expect(parseTuroEmail('Your earnings are on the way!', PAYOUT)).toEqual({ kind: 'payout', amount: 684.32 });
    expect(parseTuroEmail('Reimbursement invoice', INVOICE)).toEqual({
      kind: 'reimbursement_invoice',
      reservationId: '77778888',
      guestFirstName: 'Drew',
      total: 41.22,
      items: ['Refueling', 'Refueling convenience fee'],
    });
    expect(parseTuroEmail('Drew has been charged for your reimbursement invoice', '')).toEqual({ kind: 'reimbursement_paid', guestFirstName: 'Drew' });
    expect(parseTuroEmail('Drew has not responded to your reimbursement invoice', '').kind).toBe('reimbursement_no_response');
  });

  it('reads claim deadlines and license reminders', () => {
    expect(parseTuroEmail('Reminder — 7 days left to resolve directly with Emery', CLAIM)).toEqual({
      kind: 'claim_deadline',
      guestFirstName: 'Emery',
      carLabel: 'Lexus TX',
      plate: '0TEST00',
      incidentNumber: '1234567',
      escalateBy: '2026-10-25T18:30:00.000Z',
      reservationId: '99990000',
    });
    expect(parseTuroEmail('You still need to confirm your guest’s license', LICENSE)).toEqual({
      kind: 'license_reminder',
      guestFirstName: 'Finley',
      carLabel: 'Genesis GV70',
    });
  });

  it('ignores emails it does not need', () => {
    expect(parseTuroEmail('Your Nissan Rogue has been relisted', 'Your listing is back').kind).toBe('ignored');
  });
});
