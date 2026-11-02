import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { bookingsOnDay, bookingStatus } from '../logic/bookings';
import { monthKey } from '../logic/money';
import { can } from '../logic/permissions';
import type { Booking, BookingStatus } from '../logic/types';
import { carName, useNow, useStore } from '../state/AppStore';
import { BookingCalendar } from './BookingCalendar';
import { CHECK_IN_LABEL } from './labels';
import { Card, Chip, colors, fmtMoney, fmtTime, Muted, Row, Screen, SectionTitle, Title } from './components';

const GROUPS: { status: BookingStatus; title: string }[] = [
  { status: 'active', title: 'On trip now' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'completed', title: 'Completed' },
  { status: 'canceled', title: 'Canceled' },
];

/** Schedule built from Turo booking emails. Employees see trip times only, no money or guest details. */
export function BookingsList() {
  const { bookings, cars, currentUser } = useStore();
  const now = useNow(30_000);
  const showMoney = can(currentUser, 'viewEarnings');
  const showGuest = can(currentUser, 'viewGuestDetails');

  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const sorted = [...bookings].sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));
  const upcomingEarnings = bookings
    .filter((b) => ['upcoming', 'active'].includes(bookingStatus(b, now)))
    .reduce((s, b) => s + b.earnings, 0);

  const dayList = selectedDay ? bookingsOnDay(bookings, selectedDay) : [];
  const card = (b: Booking) => <BookingCard key={b.id} b={b} showMoney={showMoney} showGuest={showGuest} carLabel={carName(cars.find((c) => c.id === b.carId))} />;

  return (
    <Screen>
      <BookingCalendar
        bookings={bookings}
        cars={cars}
        month={month}
        onMonth={setMonth}
        selected={selectedDay}
        onSelect={setSelectedDay}
        now={now}
      />
      {selectedDay ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <SectionTitle>{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</SectionTitle>
            <Pressable onPress={() => setSelectedDay(null)} accessibilityRole="button" hitSlop={8}>
              <Muted style={{ color: colors.primary, fontWeight: '600' }}>Show all</Muted>
            </Pressable>
          </Row>
          {dayList.length ? dayList.map(card) : <Muted>No bookings this day.</Muted>}
        </>
      ) : (
        <>
          {showMoney ? (
            <Card>
              <Muted>Upcoming & active earnings</Muted>
              <Title>{fmtMoney(upcomingEarnings)}</Title>
            </Card>
          ) : null}
          {GROUPS.map(({ status, title }) => {
            const list = sorted.filter((b) => bookingStatus(b, now) === status);
            if (!list.length || (status === 'canceled' && !showGuest)) return null;
            return [<SectionTitle key={`${status}-t`}>{title}</SectionTitle>, ...list.map(card)];
          })}
          <Muted style={{ fontSize: 12 }}>Pretend bookings. Later these are filled in automatically from Turo emails in Gmail.</Muted>
        </>
      )}
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
      {showGuest && !b.canceled ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label={ci.label} tone={ci.tone} />
          {b.checkIn.state === 'waiting' ? (
            b.linkSentAt ? <Chip label="Sent in Turo" tone="good" icon="paper-plane" /> : <Chip label="Not sent yet" tone="warn" icon="paper-plane" />
          ) : null}
        </Row>
      ) : null}
    </Card>
  );
}
