import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';
import { bookingsOnDay, bookingStatus } from '../logic/bookings';
import { monthKey } from '../logic/money';
import { can } from '../logic/permissions';
import type { Booking, BookingStatus } from '../logic/types';
import { carName, useNow, useStore } from '../state/AppStore';
import { BookingCalendar } from './BookingCalendar';
import { CHECK_IN_LABEL } from './labels';
import { LOGO_SERIF } from './Brand';
import { Bouncy, glassFx, isGlass, PopIn, prefersReducedMotion, radius } from './bubble';
import { Card, Chip, colors, fmtClock, fmtMoney, fmtTime, Muted, Row, Screen, SectionTitle, Title } from './components';
import { useExpand } from './expandContext';
import { fmtDay, stubColor, VPerforation } from './ticket';
import { theme } from './theme';

const GROUPS: { status: BookingStatus; title: string }[] = [
  { status: 'active', title: 'On trip now' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'completed', title: 'Completed' },
  { status: 'canceled', title: 'Canceled' },
];

/** Every mini ticket is the same height so they stack evenly. */
const TICKET_H = 124;
/** How much of each ticket shows above the next one in a stack: guest, car, dates and times, earnings. */
const PEEK = 84;
const REVEAL_GAP = 10;

export type TicketProps = { now: Date; showMoney: boolean; showGuest: boolean; carLabel: (b: Booking) => string };

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
  const ticketProps: TicketProps = { now, showMoney, showGuest, carLabel: (b) => carName(cars.find((c) => c.id === b.carId)) };

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
          {dayList.length ? <TicketStack list={dayList} {...ticketProps} /> : <Muted>No bookings this day.</Muted>}
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
            return (
              <View key={status} style={{ gap: 8 }}>
                <SectionTitle>
                  {title} · {list.length}
                </SectionTitle>
                <TicketStack list={list} {...ticketProps} />
              </View>
            );
          })}
          <Muted style={{ fontSize: 12 }}>
            {showGuest ? 'Tap a ticket to pull it out of the stack, tap again to open it. ' : ''}Pretend bookings. Later these are filled in automatically from Turo emails in
            Gmail.
          </Muted>
        </>
      )}
    </Screen>
  );
}

/**
 * One section's bookings as a stack of tickets, each showing its top half. Hovering (mouse) or tapping
 * a ticket slides the ones below it down so it shows in full; tapping it again opens the booking.
 * The last ticket is always fully visible, so one tap opens it.
 */
export function TicketStack({ list, ...props }: { list: Booking[] } & TicketProps) {
  const [focus, setFocus] = useState<string | null>(null);
  return (
    <View>
      {list.map((b, i) => {
        const prev = list[i - 1];
        const gap = i === 0 ? 0 : prev.id === focus ? REVEAL_GAP : -(TICKET_H - PEEK);
        const isOpen = focus === b.id || i === list.length - 1;
        return (
          <StackSlot key={b.id} gap={gap}>
            <BookingTicket
              b={b}
              index={i}
              {...props}
              lifted={focus === b.id && i < list.length - 1}
              onHover={(on) => setFocus((f) => (on ? b.id : f === b.id ? null : f))}
              onTap={(open) => (isOpen ? open() : setFocus(b.id))}
            />
          </StackSlot>
        );
      })}
    </View>
  );
}

/** Springs the overlap above a ticket open or closed. */
function StackSlot({ gap, children }: { gap: number; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(gap));
  useEffect(() => {
    if (prefersReducedMotion()) v.setValue(gap);
    else Animated.spring(v, { toValue: gap, speed: 16, bounciness: 7, useNativeDriver: false }).start();
  }, [gap, v]);
  return <Animated.View style={{ marginTop: v }}>{children}</Animated.View>;
}

/** A booking as a miniature ticket: trip times on the left, a tear-off stub with the earnings on the right. */
function BookingTicket({
  b,
  index,
  now,
  showMoney,
  showGuest,
  carLabel,
  lifted,
  onHover,
  onTap,
}: { b: Booking; index: number; lifted: boolean; onHover: (on: boolean) => void; onTap: (open: () => void) => void } & TicketProps) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const ci = CHECK_IN_LABEL[b.checkIn.state];
  const st = bookingStatus(b, now);
  const days = Math.max(1, Math.round((Date.parse(b.tripEnd) - Date.parse(b.tripStart)) / 86_400_000));
  const stub = stubLabel(b, st, now);
  const car = carLabel(b);
  const open = () => {
    if (showGuest) expand(ref.current, () => router.push(`/booking/${b.id}`));
  };

  return (
    <PopIn delay={Math.min(index, 6) * 45}>
      <Bouncy
        accessibilityRole="button"
        accessibilityLabel={`${showGuest ? `${b.guestFirstName}, ` : ''}${car}, ${fmtTime(b.tripStart)} to ${fmtTime(b.tripEnd)}`}
        onHoverIn={() => onHover(true)}
        onHoverOut={() => onHover(false)}
        onPress={() => onTap(open)}
      >
        <View
          ref={ref}
          style={[
            {
              height: TICKET_H,
              flexDirection: 'row',
              backgroundColor: colors.card,
              borderRadius: radius() + 2,
              overflow: 'hidden',
              borderWidth: lifted ? 1.5 : isGlass() ? 1 : StyleSheet.hairlineWidth,
              borderColor: lifted ? theme.accent : colors.border,
            },
            glassFx(),
            // Shadow falls upward too, so each ticket's edge stands out over the one behind it.
            isGlass() ? null : { shadowColor: '#1E0E45', shadowOpacity: lifted ? 0.2 : 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 3 },
            b.canceled ? { opacity: 0.6 } : null,
          ]}
        >
          {/* Top half (always visible in a stack): who, which car, when. Bottom half: check-in status. */}
          <View style={{ flex: 1, paddingTop: 11, paddingBottom: 10, paddingLeft: 14 }}>
            <Text style={{ fontSize: 14, color: colors.muted }} numberOfLines={1}>
              {showGuest ? <Text style={{ fontWeight: '800', color: colors.text, fontSize: 15 }}>{b.guestFirstName} · </Text> : null}
              {car}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <MiniTime iso={b.tripStart} />
              <View style={{ flex: 1, marginHorizontal: 8, alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted }}>{days}D</Text>
                <View style={{ alignSelf: 'stretch', borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondary }} />
              </View>
              <MiniTime iso={b.tripEnd} right />
            </View>
            <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 6, overflow: 'hidden' }}>
              {b.canceled ? (
                <Chip label="Canceled" tone="bad" />
              ) : showGuest && st !== 'completed' ? (
                <>
                  <Chip label={ci.label} tone={ci.tone} />
                  {b.checkIn.state === 'waiting' ? (
                    b.linkSentAt ? <Chip label="Sent" tone="good" icon="paper-plane" /> : <Chip label="Not sent" tone="warn" icon="paper-plane" />
                  ) : null}
                </>
              ) : (
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {days} {days === 1 ? 'day' : 'days'}
                </Text>
              )}
            </View>
          </View>
          <VPerforation />
          <View style={{ width: 92, backgroundColor: stubColor(), alignItems: 'center', paddingTop: 12, paddingHorizontal: 6, gap: 3 }}>
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
      </Bouncy>
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
      <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>{fmtDay(iso)}</Text>
    </View>
  );
}
