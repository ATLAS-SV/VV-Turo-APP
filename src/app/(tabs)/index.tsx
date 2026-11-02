import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type HostInstance } from 'react-native';
import { bookingStatus, pickupsOn, returnsOn, tomorrow } from '../../logic/bookings';
import { isInLot } from '../../logic/geo';
import { formatMinutes, openShift, shiftMinutes } from '../../logic/hours';
import { earningItems, monthKey, summarizeMonth } from '../../logic/money';
import { can } from '../../logic/permissions';
import type { TaskWithState } from '../../logic/tasks';
import { carName, useNow, useStore, useTasks } from '../../state/AppStore';
import { colors, fmtClock, type IconName, Muted } from '../../ui/components';
import { DonutChart } from '../../ui/DonutChart';
import { useExpand } from '../../ui/expandContext';
import { EARNING_COLORS, UPCOMING_COLOR } from '../../ui/earningColors';

type Alert = { icon: IconName; text: string; to: Href };

/**
 * Master page, condensed: small boxes with the key numbers. Tap a box to open its full page.
 * To do (alerts + tasks) · Fleet · Money · Bookings · Map · Hours.
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
  const nameOf = (carId: string) => carName(cars.find((c) => c.id === carId));

  // Fleet
  const unlocked = cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked');
  const inLot = cars.filter((c) => telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot));
  const driving = cars.filter((c) => telemetry[c.id]?.moving);

  // Alerts (needs attention)
  const alerts: Alert[] = unlocked.map((c) => ({ icon: 'lock-open', text: `${carName(c)} is unlocked`, to: `/car/${c.id}` }));
  if (showGuest) {
    for (const b of bookings) {
      if (b.checkIn.state === 'unlocked') alerts.push({ icon: 'timer', text: `${b.guestFirstName}'s countdown running`, to: `/booking/${b.id}` });
      else if (bookingStatus(b, now) === 'upcoming' && b.checkIn.state === 'waiting' && !b.linkSentAt && Date.parse(b.tripStart) - now.getTime() < 48 * 3600_000)
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
  const MAX_ROWS = 4;
  const alertRows = alerts.slice(0, 2);
  const taskRows = [...overdue, ...dueSoon].slice(0, MAX_ROWS - alertRows.length);
  const hiddenCount = alerts.length + openTasks.length - alertRows.length - taskRows.length;

  // Bookings brief
  const todayOut = pickupsOn(bookings, now);
  const todayBack = returnsOn(bookings, now).filter((b) => Date.parse(b.tripEnd) >= now.getTime());
  const tomorrowOut = pickupsOn(bookings, tomorrow(now));
  const next = [...todayOut, ...tomorrowOut].find((b) => Date.parse(b.tripStart) >= now.getTime() && b.checkIn.state !== 'started');

  // Money (Executive)
  const money = isExec ? summarizeMonth(items, payouts, monthKey(now), now) : null;

  // Hours
  const myShift = openShift(shifts, currentUser.id);
  const clockedIn = isExec ? store.users.filter((u) => openShift(shifts, u.id)) : [];

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollBody>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
            {greeting}, {currentUser.name}
          </Text>
          <Muted style={{ fontSize: 13 }}>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Muted>
        </View>

        {/* To do: needs attention + tasks in one box */}
        <Box
          icon="checkbox"
          title="To do"
          badge={alerts.length + openTasks.length ? `${alerts.length + openTasks.length}` : undefined}
          badgeTone={overdue.length || alerts.length ? 'warn' : 'neutral'}
          onPress={() => router.push('/tasks')}
          headerOnly
        >
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Stat n={alerts.length} label="alerts" tone={alerts.length ? 'warn' : undefined} />
            <Stat n={overdue.length} label="overdue" tone={overdue.length ? 'bad' : undefined} />
            <Stat n={dueSoon.length} label="due soon" />
            <Stat n={openTasks.length} label="open tasks" />
          </View>
          {alertRows.map((a, i) => (
            <Pressable key={`a${i}`} onPress={() => router.push(a.to)} style={rowStyle}>
              <Ionicons name={a.icon} size={15} color={colors.unlocked} />
              <Text style={rowText} numberOfLines={1}>
                {a.text}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.muted} />
            </Pressable>
          ))}
          {taskRows.map((t) => (
            <CompactTask key={t.id} t={t} now={now} carLabel={t.carId ? nameOf(t.carId) : ''} onDone={() => completeTask(t.id, true)} />
          ))}
          {!alertRows.length && !taskRows.length ? <Muted style={{ fontSize: 13 }}>Nothing urgent. 👍</Muted> : null}
          {hiddenCount > 0 ? (
            <Pressable onPress={() => router.push('/tasks')}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>+{hiddenCount} more · See all</Text>
            </Pressable>
          ) : null}
        </Box>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Fleet */}
          <Box icon="car-sport" title="Fleet" onPress={() => router.push('/cars')} half>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Stat n={cars.length - unlocked.length} label="locked" />
              <Stat n={unlocked.length} label="unlocked" tone={unlocked.length ? 'warn' : undefined} />
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {cars.map((c) => {
                const st = telemetry[c.id]?.lockState;
                return (
                  <View
                    key={c.id}
                    accessibilityLabel={`${carName(c)} ${st ?? 'unknown'}`}
                    style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: st === 'unlocked' ? colors.unlocked : st === 'locked' ? colors.locked : colors.border }}
                  />
                );
              })}
            </View>
            <Muted style={{ fontSize: 12 }}>
              {inLot.length} in lot · {driving.length} driving
            </Muted>
          </Box>

          {/* Money (Executive) or Map (Employee) */}
          {money ? (
            <Box icon="cash" title="Money" onPress={() => router.push('/money')} half>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <DonutChart
                  size={58}
                  slices={[
                    { key: 'trip', label: 'Trip earnings', value: money.byType.trip.earned, color: EARNING_COLORS.trip },
                    { key: 'up', label: 'Upcoming', value: money.upcoming, color: UPCOMING_COLOR },
                    { key: 'r', label: 'Reimbursements', value: money.byType.reimbursement.earned + money.byType.reimbursement.upcoming, color: EARNING_COLORS.reimbursement },
                    { key: 'i', label: 'Incentives', value: money.byType.incentive.earned + money.byType.incentive.upcoming, color: EARNING_COLORS.incentive },
                  ]}
                  centerLabel=""
                  centerValue=""
                />
                <View style={{ flex: 1 }}>
                  <Muted style={{ fontSize: 11 }}>Earned</Muted>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                    {short(money.earned)}
                  </Text>
                  <Muted style={{ fontSize: 11 }}>Upcoming</Muted>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                    {short(money.upcoming)}
                  </Text>
                </View>
              </View>
            </Box>
          ) : (
            <MapBox inLot={inLot.length} out={cars.length - inLot.length} />
          )}
        </View>

        {/* Bookings brief */}
        <Box icon="calendar" title={isExec ? 'Bookings' : 'Trips'} onPress={() => router.push('/cars?view=bookings')}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat n={todayOut.length} label="out today" />
            <Stat n={todayBack.length} label="back today" />
            <Stat n={tomorrowOut.length} label="out tomorrow" />
          </View>
          {next ? (
            <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>
              <Text style={{ fontWeight: '700' }}>Next: </Text>
              {fmtClock(next.tripStart)}
              {Date.parse(next.tripStart) - now.getTime() > 12 * 3600_000 ? ' tomorrow' : ''} · {nameOf(next.carId)}
              {showGuest ? ` · ${next.guestFirstName}` : ''}
            </Text>
          ) : (
            <Muted style={{ fontSize: 13 }}>No pickups today or tomorrow.</Muted>
          )}
        </Box>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {money ? <MapBox inLot={inLot.length} out={cars.length - inLot.length} /> : null}
          {/* Hours */}
          <Box icon="time" title="Hours" onPress={() => router.push('/hours')} half={!!money} headerOnly>
            <Text style={{ fontSize: 13, color: myShift ? colors.locked : colors.muted, fontWeight: '600' }} numberOfLines={1}>
              {myShift ? `On · ${formatMinutes(shiftMinutes(myShift, now))}` : 'Off the clock'}
            </Text>
            {isExec && clockedIn.length ? (
              <Muted style={{ fontSize: 11 }} >
                {clockedIn.length} clocked in
              </Muted>
            ) : null}
            <Pressable
              onPress={toggleClock}
              accessibilityRole="button"
              style={{ backgroundColor: myShift ? colors.dangerBg : colors.neutralBg, borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}
            >
              <Text style={{ color: myShift ? colors.danger : colors.text, fontWeight: '700', fontSize: 13 }}>{myShift ? 'Clock out' : 'Clock in'}</Text>
            </Pressable>
          </Box>
        </View>
      </ScrollBody>
    </View>
  );
}

function short(n: number) {
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 3 };
const rowText = { flex: 1, color: colors.text, fontSize: 13 };

function ScrollBody({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}>{children}</ScrollView>;
}

function MapBox({ inLot, out }: { inLot: number; out: number }) {
  return (
    <Box icon="map" title="Map" onPress={() => router.push('/map')} half>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat n={inLot} label="in lot" />
        <Stat n={out} label="out" />
      </View>
    </Box>
  );
}

/** One-line task with a tick box. */
function CompactTask({ t, now, carLabel, onDone }: { t: TaskWithState; now: Date; carLabel: string; onDone: () => void }) {
  const overdue = t.status === 'overdue';
  const mins = Math.round((Date.parse(t.dueAt) - now.getTime()) / 60_000);
  return (
    <View style={rowStyle}>
      <Pressable onPress={onDone} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Mark done: ${t.title}`} hitSlop={8}>
        <Ionicons name="square-outline" size={17} color={colors.primary} />
      </Pressable>
      <Text style={rowText} numberOfLines={1}>
        {t.title}
        {carLabel ? <Text style={{ color: colors.muted }}> · {carLabel}</Text> : null}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: overdue ? colors.danger : colors.unlocked }}>
        {overdue ? 'Overdue' : mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}
      </Text>
    </View>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'warn' | 'bad' }) {
  const color = tone === 'bad' ? colors.danger : tone === 'warn' ? colors.unlocked : colors.text;
  return (
    <View>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{n}</Text>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

/** Compact box. Tap opens its page; `headerOnly` when the box has its own buttons inside. */
function Box({
  icon,
  title,
  children,
  onPress,
  half,
  headerOnly,
  badge,
  badgeTone = 'neutral',
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  onPress: () => void;
  half?: boolean;
  headerOnly?: boolean;
  badge?: string;
  badgeTone?: 'warn' | 'neutral';
}) {
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {badge ? (
        <View style={{ backgroundColor: badgeTone === 'warn' ? colors.unlockedBg : colors.neutralBg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: badgeTone === 'warn' ? colors.unlocked : colors.muted }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={15} color={colors.primary} />
    </View>
  );
  const box = {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    ...(half ? { flex: 1 } : {}),
  };
  // The box grows to fill the screen and becomes the page it opens.
  const open = () => expand(ref.current, onPress);
  if (headerOnly) {
    return (
      <View ref={ref} style={box}>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${title}`} hitSlop={6}>
          {header}
        </Pressable>
        {children}
      </View>
    );
  }
  return (
    <View ref={ref} style={box}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${title}`} style={({ pressed }) => ({ gap: 7, opacity: pressed ? 0.85 : 1 })}>
        {header}
        {children}
      </Pressable>
    </View>
  );
}
