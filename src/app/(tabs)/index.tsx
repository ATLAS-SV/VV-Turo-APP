import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { bookingStatus, pickupsOn, returnsOn, tomorrow } from '../../logic/bookings';
import { isInLot } from '../../logic/geo';
import { formatMinutes, openShift, shiftMinutes } from '../../logic/hours';
import { can } from '../../logic/permissions';
import type { Booking } from '../../logic/types';
import { carName, useNow, useStore, useTasks } from '../../state/AppStore';
import { TaskRow } from '../../ui/TaskRow';
import { Button, Chip, colors, fmtClock, type IconName, LockChip, Muted, Row, Screen } from '../../ui/components';

/** Master page: a little of everything. Tap any card to open that part of the app. */
export default function OverviewScreen() {
  const store = useStore();
  const { currentUser, cars, telemetry, settings, bookings, activity, shifts, toggleClock } = store;
  const now = useNow(30_000);
  const tasks = useTasks();
  if (!currentUser) return null;

  const isExec = currentUser.role === 'executive';
  const showGuest = can(currentUser, 'viewGuestDetails');

  // Fleet
  const unlocked = cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked');
  const inLot = cars.filter((c) => telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot));
  const driving = cars.filter((c) => telemetry[c.id]?.moving);

  // Schedule: cars going out today and tomorrow
  const todayOut = pickupsOn(bookings, now);
  const todayBack = returnsOn(bookings, now).filter((b) => Date.parse(b.tripEnd) >= now.getTime());
  const tomorrowOut = pickupsOn(bookings, tomorrow(now));

  // Tasks: overdue first, then anything due within the next day
  const openTasks = tasks.filter((t) => !t.doneAt);
  const overdueCount = openTasks.filter((t) => t.status === 'overdue').length;
  const focusTasks = openTasks.filter((t) => Date.parse(t.dueAt) - now.getTime() < 24 * 3600_000).slice(0, 5);

  // Needs attention
  const attention: { icon: IconName; text: string; to: Href }[] = [];
  for (const c of unlocked) {
    const t = telemetry[c.id];
    attention.push({ icon: 'lock-open', text: `${carName(c)} is unlocked${t && isInLot(t.position, settings.homeLot) ? ' in the lot' : ''}`, to: `/car/${c.id}` });
  }
  if (showGuest) {
    for (const b of bookings) {
      const status = bookingStatus(b, now);
      if (b.checkIn.state === 'unlocked') attention.push({ icon: 'timer', text: `${b.guestFirstName}'s car is unlocked, countdown running`, to: `/booking/${b.id}` });
      else if (status === 'upcoming' && b.checkIn.state === 'waiting' && !b.linkSentAt && Date.parse(b.tripStart) - now.getTime() < 48 * 3600_000)
        attention.push({ icon: 'paper-plane', text: `Check-in link not sent to ${b.guestFirstName} yet`, to: `/booking/${b.id}` });
    }
    const lateAlerts = activity.filter((a) => a.action === 'late_return' && now.getTime() - Date.parse(a.at) < 24 * 3600_000);
    for (const a of lateAlerts.slice(0, 2)) attention.push({ icon: 'warning', text: a.detail ?? 'Late return', to: '/activity' });
  }


  // Hours
  const open = openShift(shifts, currentUser.id);
  const clockedIn = isExec ? store.users.filter((u) => openShift(shifts, u.id)) : [];

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
          {greeting}, {currentUser.name}
        </Text>
        <Muted>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Muted>
      </View>

      <AttentionBar items={attention} />

      <Tile icon="checkbox" title={`Tasks${openTasks.length ? ` · ${openTasks.length} open` : ''}`} onPress={() => router.push('/tasks')} action="All tasks" headerLinkOnly>
        {overdueCount ? (
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
            {overdueCount} overdue
          </Text>
        ) : null}
        {focusTasks.length ? (
          focusTasks.map((t) => <TaskRow key={t.id} t={t} now={now} />)
        ) : (
          <Muted>Nothing due in the next day.</Muted>
        )}
      </Tile>

      <Tile icon="car-sport" title="Fleet" onPress={() => router.push('/cars')} action="Cars">
        <Row style={{ gap: 14 }}>
          <Big n={cars.length - unlocked.length} label="locked" />
          <Big n={unlocked.length} label="unlocked" warn={unlocked.length > 0} />
          <Big n={inLot.length} label="in lot" />
          <Big n={driving.length} label="driving" />
        </Row>
        {cars.map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {carName(c)}
            </Text>
            <LockChip state={telemetry[c.id]?.lockState} />
          </Row>
        ))}
      </Tile>

      <Row style={{ alignItems: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Tile icon="map" title="Map" onPress={() => router.push('/map')} compact>
            <Muted>
              {inLot.length} at {settings.homeLot.name}
              {'\n'}
              {cars.length - inLot.length} out
            </Muted>
          </Tile>
        </View>
        <View style={{ flex: 1 }}>
          <Tile icon="time" title="Hours" onPress={() => router.push('/hours')} compact headerLinkOnly>
            <Muted>{open ? `On the clock · ${formatMinutes(shiftMinutes(open, now))}` : 'Off the clock'}</Muted>
            {isExec && clockedIn.length ? <Muted>{clockedIn.map((u) => u.name).join(', ')} clocked in</Muted> : null}
            <Button
              label={open ? 'Clock out' : 'Clock in'}
              variant={open ? 'danger' : 'secondary'}
              onPress={toggleClock}
              style={{ paddingVertical: 6, minHeight: 34 }}
            />
          </Tile>
        </View>
      </Row>

      <Tile icon="today" title="Going out today" onPress={() => router.push('/cars?view=bookings')} action={isExec ? 'Bookings' : 'Trips'} headerLinkOnly>
        {todayOut.length ? (
          todayOut.map((b) => <PickupRow key={b.id} b={b} showGuest={showGuest} carLabel={carName(cars.find((c) => c.id === b.carId))} now={now} />)
        ) : (
          <Muted>No cars going out today.</Muted>
        )}
        {todayBack.length ? (
          <Muted style={{ fontSize: 13 }}>
            Coming back today: {todayBack.map((b) => `${carName(cars.find((c) => c.id === b.carId))} (${fmtClock(b.tripEnd)})`).join(', ')}
          </Muted>
        ) : null}
      </Tile>

      <Tile icon="calendar" title="Going out tomorrow" onPress={() => router.push('/cars?view=bookings')} action="Schedule" headerLinkOnly>
        {tomorrowOut.length ? (
          tomorrowOut.map((b) => <PickupRow key={b.id} b={b} showGuest={showGuest} carLabel={carName(cars.find((c) => c.id === b.carId))} now={now} />)
        ) : (
          <Muted>No cars going out tomorrow.</Muted>
        )}
      </Tile>

    </Screen>
  );
}

function Tile({
  icon,
  title,
  children,
  onPress,
  action,
  tone,
  compact,
  headerLinkOnly,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  onPress?: () => void;
  action?: string;
  tone?: 'warn' | 'good';
  compact?: boolean;
  /** Card has its own buttons inside: only the header opens the page (no button-inside-button). */
  headerLinkOnly?: boolean;
}) {
  const accent = tone === 'warn' ? colors.unlocked : tone === 'good' ? colors.locked : colors.primary;
  const bg = tone === 'warn' ? colors.unlockedBg : tone === 'good' ? colors.lockedBg : colors.card;
  const header = (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row>
        <Ionicons name={icon} size={18} color={accent} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
      </Row>
      {onPress ? (
        <Row style={{ gap: 2 }}>
          {action ? <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{action}</Text> : null}
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Row>
      ) : null}
    </Row>
  );
  // Only the side-by-side compact cards stretch; full-width cards size to their content.
  const box = { backgroundColor: bg, borderRadius: 14, padding: compact ? 12 : 14, gap: 8, borderWidth: 1, borderColor: colors.border, ...(compact ? { flex: 1 } : {}) };
  const label = `Open ${title}`;
  if (!onPress) {
    return (
      <View style={box}>
        {header}
        {children}
      </View>
    );
  }
  if (headerLinkOnly) {
    return (
      <View style={box}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
          {header}
        </Pressable>
        {children}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}>
      {header}
      {children}
    </Pressable>
  );
}

/** Slim bar with the count and the most urgent item; tap to expand the full list. */
function AttentionBar({ items }: { items: { icon: IconName; text: string; to: Href }[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.lockedBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
        <Ionicons name="checkmark-circle" size={18} color={colors.locked} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>All good. Nothing needs you right now.</Text>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.unlockedBg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, gap: 4 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Needs attention, ${items.length} ${items.length === 1 ? 'item' : 'items'}. ${open ? 'Collapse' : 'Expand'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Ionicons name="alert-circle" size={18} color={colors.unlocked} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Needs attention · {items.length}</Text>
          {!open ? (
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
              {items[0].text}
              {items.length > 1 ? ` +${items.length - 1} more` : ''}
            </Text>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.unlocked} />
      </Pressable>
      {open
        ? items.map((a, i) => (
            <Pressable key={i} onPress={() => router.push(a.to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 26 }}>
              <Ionicons name={a.icon} size={15} color={colors.unlocked} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{a.text}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </Pressable>
          ))
        : null}
    </View>
  );
}

/** One car going out: time, car, guest (Executive), and where the pickup stands. */
function PickupRow({ b, showGuest, carLabel, now }: { b: Booking; showGuest: boolean; carLabel: string; now: Date }) {
  const status =
    b.checkIn.state === 'started'
      ? { label: 'Picked up', tone: 'good' as const }
      : b.checkIn.state === 'unlocked'
        ? { label: 'Guest unlocked', tone: 'warn' as const }
        : Date.parse(b.tripStart) < now.getTime()
          ? { label: 'Not picked up', tone: 'bad' as const }
          : showGuest
            ? b.linkSentAt
              ? { label: 'Link sent', tone: 'info' as const }
              : { label: 'Link not sent', tone: 'warn' as const }
            : { label: 'Scheduled', tone: 'neutral' as const };
  const row = (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={{ width: 70, fontWeight: '700', color: colors.text, fontSize: 14 }}>{fmtClock(b.tripStart)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {carLabel}
        </Text>
        {showGuest ? <Muted style={{ fontSize: 12 }}>{b.guestFirstName}</Muted> : null}
      </View>
      <Chip label={status.label} tone={status.tone} />
    </Row>
  );
  if (!showGuest) return row;
  return <Pressable onPress={() => router.push(`/booking/${b.id}`)}>{row}</Pressable>;
}

function Big({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: warn ? colors.unlocked : colors.text }}>{n}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}
