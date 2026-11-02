import { router } from 'expo-router';
import { bookingStatus } from '../../logic/bookings';
import { can } from '../../logic/permissions';
import type { Booking, BookingStatus } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import { CHECK_IN_LABEL } from '../../ui/labels';
import { Card, Chip, fmtMoney, fmtTime, Muted, Row, Screen, SectionTitle, Title } from '../../ui/components';

const GROUPS: { status: BookingStatus; title: string }[] = [
  { status: 'active', title: 'On trip now' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'completed', title: 'Completed' },
  { status: 'canceled', title: 'Canceled' },
];

/** Schedule built from Turo booking emails. Employees see trip times only, no money or guest details. */
export default function BookingsScreen() {
  const { bookings, cars, currentUser } = useStore();
  const now = useNow(30_000);
  const showMoney = can(currentUser, 'viewEarnings');
  const showGuest = can(currentUser, 'viewGuestDetails');

  const sorted = [...bookings].sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));
  const upcomingEarnings = bookings
    .filter((b) => ['upcoming', 'active'].includes(bookingStatus(b, now)))
    .reduce((s, b) => s + b.earnings, 0);

  return (
    <Screen>
      <Muted>Pretend bookings. Later these will be filled in automatically from Turo emails in Gmail.</Muted>
      {showMoney ? (
        <Card>
          <Muted>Upcoming & active earnings</Muted>
          <Title>{fmtMoney(upcomingEarnings)}</Title>
        </Card>
      ) : null}
      {GROUPS.map(({ status, title }) => {
        const list = sorted.filter((b) => bookingStatus(b, now) === status);
        if (!list.length || (status === 'canceled' && !showGuest)) return null;
        return [
          <SectionTitle key={`${status}-t`}>{title}</SectionTitle>,
          ...list.map((b) => <BookingCard key={b.id} b={b} showMoney={showMoney} showGuest={showGuest} carLabel={carName(cars.find((c) => c.id === b.carId))} />),
        ];
      })}
    </Screen>
  );
}

function BookingCard({ b, showMoney, showGuest, carLabel }: { b: Booking; showMoney: boolean; showGuest: boolean; carLabel: string }) {
  const ci = CHECK_IN_LABEL[b.checkIn.state];
  return (
    <Card onPress={showGuest ? () => router.push(`/booking/${b.id}`) : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>{showGuest ? `${b.guestFirstName} · ` : ''}{carLabel}</Title>
        {showMoney ? <Title>{fmtMoney(b.earnings)}</Title> : null}
      </Row>
      <Muted>
        {fmtTime(b.tripStart)} → {fmtTime(b.tripEnd)}
      </Muted>
      {showGuest && !b.canceled ? <Chip label={ci.label} tone={ci.tone} /> : null}
    </Card>
  );
}
