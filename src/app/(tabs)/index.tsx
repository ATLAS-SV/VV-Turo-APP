import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type HostInstance } from 'react-native';
import { bookingStatus, pickupsOn, returnsOn } from '../../logic/bookings';
import { isInLot } from '../../logic/geo';
import { openShift } from '../../logic/hours';
import { earningItems, monthKey, summarizeMonth } from '../../logic/money';
import { can } from '../../logic/permissions';
import type { TaskWithState } from '../../logic/tasks';
import type { Booking } from '../../logic/types';
import { carName, useNow, useStore, useTasks } from '../../state/AppStore';
import { LOGO_SERIF } from '../../ui/Brand';
import { TicketStack } from '../../ui/BookingsList';
import { Bouncy, glassFx, isGlass, PopAway, PopIn, radius } from '../../ui/bubble';
import { colors, fmtClock, type IconName, Muted } from '../../ui/components';
import { useExpand } from '../../ui/expandContext';
import { fmtDay, Perforation, stubColor, ticketShadow } from '../../ui/ticket';
import { getAppearance, isLightLook, theme } from '../../ui/theme';

type Alert = { icon: IconName; text: string; to: Href };

// The day bar on the pass runs from 6 AM to 10 PM.
const DAY_START_H = 6;
const DAY_END_H = 22;

/**
 * Overview (layout F): the next trip as a boarding pass (pickup → return, with a bar of today's
 * events on its stub), then quick stats, what needs you, and the trips after that as stacked tickets.
 */
export default function OverviewScreen() {
  const store = useStore();
  const { currentUser, cars, telemetry, settings, bookings, activity, shifts, toggleClock, completeTask, earningExtras, payouts } = store;
  const now = useNow(30_000);
  const tasks = useTasks();
  const items = useMemo(() => earningItems(bookings, earningExtras), [bookings, earningExtras]);
  if (!currentUser) return null;

  const isExec = currentUser.role === 'executive';
  const showGuest = can(currentUser, 'viewGuestDetails');
  const showMoney = can(currentUser, 'viewEarnings');
  const nameOf = (carId: string) => carName(cars.find((c) => c.id === carId));

  // Fleet
  const unlocked = cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked');
  const inLot = cars.filter((c) => telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot));

  // Trips: the pass shows the next pickup (or, if none, the next return); the rest stack below it.
  const live = bookings.filter((b) => ['upcoming', 'active'].includes(bookingStatus(b, now)));
  const nextTime = (b: Booking) => Date.parse(bookingStatus(b, now) === 'active' ? b.tripEnd : b.tripStart);
  const byNext = [...live].sort((a, b) => nextTime(a) - nextTime(b));
  const pass = byNext.find((b) => bookingStatus(b, now) === 'upcoming') ?? byNext[0];
  const after = byNext.filter((b) => b.id !== pass?.id).slice(0, 4);

  // Alerts (needs attention)
  const alerts: Alert[] = unlocked.map((c) => ({ icon: 'lock-open', text: `${carName(c)} is unlocked`, to: `/car/${c.id}` }));
  if (showGuest) {
    for (const b of bookings) {
      if (b.checkIn.state === 'unlocked') alerts.push({ icon: 'timer', text: `${b.guestFirstName}'s countdown running`, to: `/booking/${b.id}` });
      else if (b.id !== pass?.id && bookingStatus(b, now) === 'upcoming' && b.checkIn.state === 'waiting' && !b.linkSentAt && Date.parse(b.tripStart) - now.getTime() < 48 * 3600_000)
        alerts.push({ icon: 'paper-plane', text: `Send ${b.guestFirstName} the check-in link`, to: `/booking/${b.id}` });
    }
    for (const a of activity.filter((x) => x.action === 'late_return' && now.getTime() - Date.parse(x.at) < 24 * 3600_000).slice(0, 2)) {
      alerts.push({ icon: 'warning', text: `${a.carId ? nameOf(a.carId) : 'Car'} not back from trip`, to: '/activity' });
    }
  }

  // Tasks: overdue first, then due soon
  const openTasks = tasks.filter((t) => !t.doneAt);
  const overdue = openTasks.filter((t) => t.status === 'overdue');
  const dueSoon = openTasks.filter((t) => t.status === 'due_soon');
  const urgent = [...overdue, ...dueSoon];
  const needCount = alerts.length + urgent.length;
  const MAX_ROWS = 3;
  const alertRows = alerts.slice(0, 1);
  const taskRows = urgent.slice(0, MAX_ROWS - alertRows.length);
  const hiddenCount = alerts.length + openTasks.length - alertRows.length - taskRows.length;

  const money = showMoney ? summarizeMonth(items, payouts, monthKey(now), now) : null;
  const myShift = openShift(shifts, currentUser.id);

  // Purple band behind the pass in Light (the dark looks are already purple).
  const band = getAppearance() === 'light' ? theme.primary : null;
  const onBand = band ? '#FFFFFF' : colors.text;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}>
        {band ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, backgroundColor: band, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: onBand, fontSize: 16, fontWeight: '800' }}>{pass && bookingStatus(pass, now) === 'active' ? 'Next return' : 'Next up'}</Text>
          {pass ? (
            <View style={{ backgroundColor: 'rgba(212,175,55,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: band ? '#F7DE8A' : colors.primary, fontSize: 12, fontWeight: '800' }}>{countdown(pass, now)}</Text>
            </View>
          ) : null}
        </View>

        {pass ? (
          <NextPass b={pass} now={now} showGuest={showGuest} carLabel={nameOf(pass.carId)} tasks={tasks} bookings={bookings} />
        ) : (
          <PopIn>
            <View style={[cardStyle(), { alignItems: 'center', gap: 6, paddingVertical: 22 }]}>
              <Ionicons name="calendar-outline" size={26} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>No trips coming up</Text>
              <Muted style={{ fontSize: 13 }}>New bookings from Turo show up here.</Muted>
            </View>
          </PopIn>
        )}

        {/* Quick stats */}
        <PopIn delay={70}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill value={String(needCount)} label="need you" tone={needCount ? colors.unlocked : colors.text} onPress={() => router.push('/tasks')} />
            <Pill
              value={`${cars.length - unlocked.length}/${cars.length}`}
              label="locked"
              tone={unlocked.length ? colors.unlocked : colors.locked}
              onPress={() => router.push('/cars')}
            />
            {money ? (
              <Pill value={short(money.earned)} label={`${now.toLocaleDateString(undefined, { month: 'short' })} earned`} onPress={() => router.push('/money')} />
            ) : (
              <Pill value={String(inLot.length)} label="in lot" onPress={() => router.push('/map')} />
            )}
            <Pill
              value={myShift ? 'Clock out' : 'Clock in'}
              label={myShift ? 'on the clock' : 'hours'}
              tone={myShift ? colors.danger : colors.primary}
              small
              onPress={toggleClock}
            />
          </View>
        </PopIn>

        {/* Mini calendar: the next two weeks */}
        <PopIn delay={110}>
          <MiniCalendar bookings={bookings} now={now} tasks={tasks} />
        </PopIn>

        {/* What needs you */}
        <PopIn delay={160}>
          <View style={{ gap: 8 }}>
            <SectionLabel>{pass && bookingStatus(pass, now) === 'upcoming' ? `Needs you before ${fmtClock(pass.tripStart)}` : 'Needs you'}</SectionLabel>
            <View style={[cardStyle(), { paddingVertical: 4 }]}>
              {alertRows.map((a, i) => (
                <AlertRow key={`a${i}`} alert={a} />
              ))}
              {taskRows.map((t) => (
                <NeedRow key={t.id} t={t} now={now} carLabel={t.carId ? nameOf(t.carId) : ''} onDone={() => completeTask(t.id, true)} />
              ))}
              {!alertRows.length && !taskRows.length ? <Muted style={{ fontSize: 13, paddingVertical: 10 }}>Nothing urgent right now.</Muted> : null}
              {hiddenCount > 0 ? (
                <Pressable onPress={() => router.push('/tasks')} accessibilityRole="button" style={{ paddingVertical: 9 }}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>See all {openTasks.length + alerts.length} ›</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </PopIn>

        {/* The trips after that, as stacked tickets */}
        {after.length ? (
          <View style={{ gap: 8 }}>
            <Row>
              <SectionLabel>After that</SectionLabel>
              <Pressable onPress={() => router.push('/cars?view=bookings')} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>All {isExec ? 'bookings' : 'trips'} ›</Text>
              </Pressable>
            </Row>
            <TicketStack list={after} now={now} showMoney={showMoney} showGuest={showGuest} carLabel={(b) => nameOf(b.carId)} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** "Starts in 28 min", "Starts in 5 h", "Back in 20 h"… */
function countdown(b: Booking, now: Date) {
  const active = bookingStatus(b, now) === 'active';
  const mins = Math.round((Date.parse(active ? b.tripEnd : b.tripStart) - now.getTime()) / 60_000);
  const verb = active ? 'Back' : 'Starts';
  if (mins <= 0) return active ? 'Due back now' : 'Pickup time';
  if (mins < 60) return `${verb} in ${mins} min`;
  if (mins < 48 * 60) return `${verb} in ${Math.round(mins / 60)} h`;
  return `${verb} ${fmtDay(active ? b.tripEnd : b.tripStart)}`;
}

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso);
  const t = new Date(now);
  if (d.toDateString() === t.toDateString()) return 'Today';
  t.setDate(t.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return 'Tomorrow';
  return fmtDay(iso);
}

/** The next trip as a boarding pass. Tapping it grows it into the booking page. */
function NextPass({
  b,
  now,
  showGuest,
  carLabel,
  tasks,
  bookings,
}: {
  b: Booking;
  now: Date;
  showGuest: boolean;
  carLabel: string;
  tasks: TaskWithState[];
  bookings: Booking[];
}) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const days = Math.max(1, Math.round((Date.parse(b.tripEnd) - Date.parse(b.tripStart)) / 86_400_000));
  const needsLink = showGuest && bookingStatus(b, now) === 'upcoming' && b.checkIn.state === 'waiting' && !b.linkSentAt;
  const open = () => expand(ref.current, () => router.push(showGuest ? `/booking/${b.id}` : `/car/${b.carId}`), { radius: radius() + 6 });

  return (
    <PopIn>
      <Bouncy
        accessibilityRole="button"
        accessibilityLabel={`${showGuest ? `${b.guestFirstName}, ` : ''}${carLabel}. Pickup ${dayLabel(b.tripStart, now)} ${fmtClock(b.tripStart)}, return ${fmtDay(b.tripEnd)} ${fmtClock(b.tripEnd)}.${needsLink ? ' Check-in link not sent.' : ''}`}
        onPress={open}
      >
        <View
          ref={ref}
          style={[{ backgroundColor: colors.card, borderRadius: radius() + 6, overflow: 'hidden', borderWidth: isGlass() ? 1 : 0, borderColor: colors.border }, ticketShadow(), glassFx()]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: stubColor() }}>
            <Text style={{ fontFamily: LOGO_SERIF, fontSize: 19, fontWeight: '700', color: colors.primary }}>VV</Text>
            <Text style={{ flexShrink: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: getAppearance() === 'light' ? '#92400E' : colors.muted }} numberOfLines={1}>
              {(showGuest ? `${b.guestFirstName} · ${carLabel}` : carLabel).toUpperCase()}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
            <PassTime label="PICKUP" iso={b.tripStart} day={dayLabel(b.tripStart, now)} />
            <View style={{ flex: 1, marginHorizontal: 10, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>
                {days} {days === 1 ? 'day' : 'days'}
              </Text>
              <View style={{ alignSelf: 'stretch', borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.secondary }} />
            </View>
            <PassTime label="RETURN" iso={b.tripEnd} day={dayLabel(b.tripEnd, now)} right />
          </View>

          <Perforation size={26} />

          <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 14, gap: 12 }}>
            <DayBar now={now} highlight={b} tasks={tasks} bookings={bookings} />
            <View
              style={{
                height: 44,
                borderRadius: isGlass() ? 999 : 12,
                backgroundColor: colors.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name={needsLink ? 'paper-plane' : 'open-outline'} size={17} color={colors.primaryText} />
              <Text style={{ color: colors.primaryText, fontSize: 15, fontWeight: '800' }}>{needsLink ? 'Send check-in link' : showGuest ? 'Open trip' : 'Open car'}</Text>
            </View>
          </View>
        </View>
      </Bouncy>
    </PopIn>
  );
}

function PassTime({ label, iso, day, right }: { label: string; iso: string; day: string; right?: boolean }) {
  const [time, ampm] = fmtClock(iso).split(/\s(?=[AP]M$)/i);
  return (
    <View style={{ alignItems: right ? 'flex-end' : 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>
        {time}
        {ampm ? <Text style={{ fontSize: 13 }}> {ampm}</Text> : null}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{day}</Text>
    </View>
  );
}

/**
 * Today at a glance, 6 AM–10 PM: the bar fills up to now, with dots for today's pickups (purple),
 * returns (green) and tasks due (gold; red when overdue). The pass's own trip gets the big dot.
 */
function DayBar({ now, highlight, tasks, bookings }: { now: Date; highlight: Booking; tasks: TaskWithState[]; bookings: Booking[] }) {
  const start = new Date(now);
  start.setHours(DAY_START_H, 0, 0, 0);
  const span = (DAY_END_H - DAY_START_H) * 3600_000;
  const pos = (t: number) => Math.min(1, Math.max(0, (t - start.getTime()) / span));
  const today = (iso: string) => new Date(iso).toDateString() === now.toDateString();

  type Dot = { key: string; at: number; color: string; size: number; label: string };
  const dots: Dot[] = [];
  for (const b of bookings) {
    if (b.canceled) continue;
    const big = b.id === highlight.id;
    if (today(b.tripStart)) dots.push({ key: `p${b.id}`, at: pos(Date.parse(b.tripStart)), color: pickupColor(), size: big ? 16 : 12, label: `Pickup ${fmtClock(b.tripStart)}` });
    if (today(b.tripEnd)) dots.push({ key: `r${b.id}`, at: pos(Date.parse(b.tripEnd)), color: colors.locked, size: big ? 16 : 12, label: `Return ${fmtClock(b.tripEnd)}` });
  }
  for (const t of tasks) {
    if (t.doneAt || (!today(t.dueAt) && t.status !== 'overdue')) continue;
    dots.push({ key: `t${t.id}`, at: pos(Date.parse(t.dueAt)), color: t.status === 'overdue' ? colors.danger : theme.accent, size: 10, label: t.title });
  }
  const nowAt = pos(now.getTime());
  const ticks = ['6a', '10a', '2p', '6p', '10p'];

  return (
    <View style={{ gap: 4 }} accessibilityLabel={`Today: ${dots.map((d) => d.label).join(', ') || 'nothing scheduled'}`}>
      <Row>
        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.5 }}>YOUR DAY</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.unlocked }}>now {fmtClock(now.toISOString())}</Text>
      </Row>
      <View style={{ height: 24, justifyContent: 'center' }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.neutralBg }} />
        <View style={{ position: 'absolute', left: 0, width: `${nowAt * 100}%`, height: 3, borderRadius: 2, backgroundColor: theme.accent }} />
        <View style={{ position: 'absolute', left: `${nowAt * 100}%`, marginLeft: -1, top: 1, bottom: 1, width: 2, borderRadius: 1, backgroundColor: theme.accent }} />
        {dots.map((d) => (
          <View
            key={d.key}
            style={{
              position: 'absolute',
              left: `${d.at * 100}%`,
              marginLeft: -d.size / 2,
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
              backgroundColor: d.color,
              borderWidth: 2,
              borderColor: colors.card === 'transparent' ? colors.bg : isGlass() ? 'rgba(255,255,255,0.9)' : colors.card,
            }}
          />
        ))}
      </View>
      <Row>
        {ticks.map((t) => (
          <Text key={t} style={{ fontSize: 10, fontWeight: '600', color: colors.muted }}>
            {t}
          </Text>
        ))}
      </Row>
    </View>
  );
}

/**
 * Two weeks at a glance, starting this Sunday. Each day shows a dot per pickup (purple) and return
 * (green), and a gold dot when a task is overdue or due that day. Tap a day to open it in Bookings.
 */
function MiniCalendar({ bookings, now, tasks }: { bookings: Booking[]; now: Date; tasks: TaskWithState[] }) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 12);
  const days = Array.from({ length: 14 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = key(now);
  const range = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[13].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <View style={[cardStyle(), { paddingVertical: 12, gap: 8 }]}>
      <Row>
        <View>
          <SectionLabel>Next 2 weeks</SectionLabel>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{range}</Text>
        </View>
        <Pressable onPress={() => router.push('/cars?view=bookings')} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Full calendar ›</Text>
        </Pressable>
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.muted }}>
            {d}
          </Text>
        ))}
      </View>
      {[0, 1].map((w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {days.slice(w * 7, w * 7 + 7).map((d) => {
            const k = key(d);
            const out = pickupsOn(bookings, d).length;
            const back = returnsOn(bookings, d).length;
            const due = tasks.some((t) => !t.doneAt && key(new Date(t.dueAt)) === k);
            const isToday = k === todayKey;
            const past = k < todayKey;
            const label = `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${out} pickups, ${back} returns${due ? ', tasks due' : ''}`;
            return (
              <Pressable
                key={k}
                onPress={() => router.push(`/cars?view=bookings&day=${k}` as Href)}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3, opacity: past ? 0.45 : 1 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? colors.primary : 'transparent',
                    borderWidth: isToday ? 0 : out || back ? 1.5 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: isToday ? '800' : '600', color: isToday ? colors.primaryText : colors.text }}>{d.getDate()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                  {Array.from({ length: Math.min(out, 3) }).map((_, i) => (
                    <View key={`o${i}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pickupColor() }} />
                  ))}
                  {Array.from({ length: Math.min(back, 3) }).map((_, i) => (
                    <View key={`b${i}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.locked }} />
                  ))}
                  {due && !out && !back ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>
        <Legend color={pickupColor()} label="Pickup" />
        <Legend color={colors.locked} label="Return" />
        <Legend color={theme.accent} label="Task due" />
      </View>
    </View>
  );
}

/** Pickups: purple in the light looks; lavender in the dark ones, where the primary color is gold (gold = task due). */
const pickupColor = () => (isLightLook() ? colors.primary : colors.secondary);

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function Pill({ value, label, tone, small, onPress }: { value: string; label: string; tone?: string; small?: boolean; onPress: () => void }) {
  return (
    <Bouncy
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={[{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius(), paddingVertical: 8, paddingHorizontal: 10 }, glassFx()]}
    >
      <Text style={{ fontSize: small ? 14 : 18, lineHeight: 23, fontWeight: '800', color: tone ?? colors.text }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }} numberOfLines={1}>
        {label}
      </Text>
    </Bouncy>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</Text>;
}

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>{children}</View>;
}

const cardStyle = () => ({ backgroundColor: colors.card, borderRadius: radius() + 2, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, ...glassFx() });

function short(n: number) {
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** A "needs attention" line; tapping it grows the row into the page it opens. */
function AlertRow({ alert }: { alert: Alert }) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  return (
    <Pressable
      ref={ref}
      onPress={() => expand(ref.current, () => router.push(alert.to), { radius: 8 })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Ionicons name={alert.icon} size={16} color={colors.unlocked} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
        {alert.text}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
  );
}

/** A task that needs you: colored dot, title, when, and a tick to finish it. */
function NeedRow({ t, now, carLabel, onDone }: { t: TaskWithState; now: Date; carLabel: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const overdue = t.status === 'overdue';
  const mins = Math.round((Date.parse(t.dueAt) - now.getTime()) / 60_000);
  const ring = overdue ? colors.danger : theme.accent;
  // Tick it: the row swells, the circle fills with a check, then the row shrinks away and it's done.
  return (
    <PopAway leaving={leaving} onGone={onDone}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: overdue ? colors.danger : theme.accent }} />
        <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {t.title}
          {carLabel ? <Text style={{ color: colors.muted, fontWeight: '400' }}> · {carLabel}</Text> : null}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: overdue ? colors.danger : colors.unlocked }}>
          {overdue ? 'Overdue' : mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`}
        </Text>
        <Pressable
          onPress={() => setLeaving(true)}
          disabled={leaving}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: leaving }}
          accessibilityLabel={`Mark done: ${t.title}`}
          hitSlop={8}
          style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: ring, backgroundColor: leaving ? ring : 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          {leaving ? <Ionicons name="checkmark" size={16} color={overdue ? '#FFFFFF' : '#1E0E45'} /> : null}
        </Pressable>
      </View>
    </PopAway>
  );
}
