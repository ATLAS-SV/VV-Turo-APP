import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';
import { bookingsOnDay, bookingStatus } from '../logic/bookings';
import { monthKey } from '../logic/money';
import { can } from '../logic/permissions';
import type { Booking, BookingStatus } from '../logic/types';
import { carName, useNow, useStore } from '../state/AppStore';
import { BookingCalendar } from './BookingCalendar';
import { CHECK_IN_LABEL } from './labels';
import { LOGO_SERIF } from './Brand';
import { Bouncy, glassFx, isGlass, PopIn, radius } from './bubble';
import { Card, Chip, colors, fmtClock, fmtMoney, fmtTime, Muted, Row, Screen, SectionTitle, Title } from './components';
import { useExpand } from './expandContext';
import { fmtDay, stubColor, VPerforation } from './ticket';

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
  const card = (b: Booking, i: number) => (
    <BookingTicket key={b.id} b={b} index={i} now={now} showMoney={showMoney} showGuest={showGuest} carLabel={carName(cars.find((c) => c.id === b.carId))} />
  );

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

/** A booking as a miniature ticket: trip times on the left, a tear-off stub with the earnings on the right. */
function BookingTicket({ b, showMoney, showGuest, carLabel, now, index }: { b: Booking; showMoney: boolean; showGuest: boolean; carLabel: string; now: Date; index: number }) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const ci = CHECK_IN_LABEL[b.checkIn.state];
  const st = bookingStatus(b, now);
  const days = Math.max(1, Math.round((Date.parse(b.tripEnd) - Date.parse(b.tripStart)) / 86_400_000));
  const stub = stubLabel(b, st, now);

  const body = (
    <View
      ref={ref}
      style={[
        { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius() + 2, overflow: 'hidden', borderWidth: isGlass() ? 1 : StyleSheet.hairlineWidth, borderColor: colors.border },
        glassFx(),
        isGlass() ? null : { shadowColor: '#1E0E45', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
        b.canceled ? { opacity: 0.6 } : null,
      ]}
    >
      <View style={{ flex: 1, paddingVertical: 12, paddingLeft: 14, gap: 6 }}>
        <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={1}>
          {showGuest ? <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>{b.guestFirstName} · </Text> : null}
          {carLabel}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MiniTime iso={b.tripStart} />
          <View style={{ flex: 1, marginHorizontal: 8, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted }}>{days}D</Text>
            <View style={{ alignSelf: 'stretch', borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondary }} />
          </View>
          <MiniTime iso={b.tripEnd} right />
        </View>
        {b.canceled ? (
          <Chip label="Canceled" tone="bad" />
        ) : showGuest && st !== 'completed' ? (
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            <Chip label={ci.label} tone={ci.tone} />
            {b.checkIn.state === 'waiting' ? (
              b.linkSentAt ? <Chip label="Sent" tone="good" icon="paper-plane" /> : <Chip label="Not sent" tone="warn" icon="paper-plane" />
            ) : null}
          </Row>
        ) : null}
      </View>
      <VPerforation />
      <View style={{ width: 92, backgroundColor: stubColor(), alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 3 }}>
        <Text style={{ fontFamily: LOGO_SERIF, fontSize: 15, fontWeight: '700', color: colors.primary }}>VV</Text>
        {showMoney ? (
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
            {fmtMoney(b.earnings)}
          </Text>
        ) : null}
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: stub.color, textAlign: 'center' }} numberOfLines={2}>
          {stub.text}
        </Text>
      </View>
    </View>
  );

  return (
    <PopIn delay={Math.min(index, 6) * 45}>
      {showGuest ? (
        <Bouncy
          accessibilityRole="button"
          accessibilityLabel={`${b.guestFirstName}, ${carLabel}, ${fmtTime(b.tripStart)} to ${fmtTime(b.tripEnd)}`}
          onPress={() => expand(ref.current, () => router.push(`/booking/${b.id}`))}
        >
          {body}
        </Bouncy>
      ) : (
        body
      )}
    </PopIn>
  );
}

/** Short status for the stub: "IN 20 MIN", "ON TRIP", "DONE"… */
function stubLabel(b: Booking, st: BookingStatus, now: Date): { text: string; color: string } {
  if (st === 'canceled') return { text: 'CANCELED', color: colors.danger };
  if (st === 'completed') return { text: 'DONE', color: colors.muted };
  if (st === 'active') return { text: 'ON TRIP', color: colors.locked };
  const mins = Math.round((Date.parse(b.tripStart) - now.getTime()) / 60_000);
  if (mins < 60) return { text: `IN ${Math.max(0, mins)} MIN`, color: colors.unlocked };
  if (mins < 48 * 60) return { text: `IN ${Math.round(mins / 60)} H`, color: colors.primary };
  return { text: `IN ${Math.round(mins / 1440)} DAYS`, color: colors.muted };
}

function MiniTime({ iso, right }: { iso: string; right?: boolean }) {
  const [time, ampm] = fmtClock(iso).split(/\s(?=[AP]M$)/i);
  return (
    <View style={{ alignItems: right ? 'flex-end' : 'flex-start' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>
        {time}
        {ampm ? <Text style={{ fontSize: 11 }}> {ampm}</Text> : null}
      </Text>
      <Text style={{ fontSize: 11, color: colors.muted }}>{fmtDay(iso)}</Text>
    </View>
  );
}
