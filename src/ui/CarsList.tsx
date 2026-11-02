import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, type HostInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextBookingForCar } from '../logic/bookings';
import { distanceMeters, formatDistance, isInLot, polygonCenter } from '../logic/geo';
import { can, canUnlockCar } from '../logic/permissions';
import type { Booking, Car, CarTelemetry } from '../logic/types';
import { carName, useNow, useStore } from '../state/AppStore';
import { Bouncy, glassFx, isGlass, PopIn } from './bubble';
import { colors, fmtAgo, fmtClock, Muted } from './components';
import { useExpand } from './expandContext';
import { FilterChips, matchesQuery, NoMatches, SearchBar, type FilterOption } from './filters';
import LogoGradient from './LogoGradient';
import { LOGO } from './logoColors';
import { getAppearance } from './theme';
import { UnlockPrompt } from './UnlockPrompt';

/**
 * The fleet as a train (Cars tab, layout 1A): a locomotive in the logo's colors leads with the fleet
 * summary and Lock all, then one carriage per car — window strip on top, wheels underneath, couplers
 * between. Tap a carriage to open the car; its round button locks it (or unlocks with your PIN).
 */
export function CarsList() {
  const store = useStore();
  const { cars, telemetry, settings, bookings, currentUser, lockCar, refresh } = store;
  const now = useNow(30_000);
  const insets = useSafeAreaInsets();
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lockingAll, setLockingAll] = useState(false);
  const showGuest = can(currentUser, 'viewGuestDetails');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CarFilter>('all');

  const unlocked = cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked');
  const inLot = cars.filter((c) => telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot));
  const driving = cars.filter((c) => telemetry[c.id]?.moving);
  const away = cars.length - inLot.length - driving.length;
  const band = getAppearance() === 'light';

  // Built to scale past a handful of cars: every car's key facts, then search + filter + sort.
  const rows = cars.map((car) => {
    const t = telemetry[car.id];
    const next = nextBookingForCar(bookings, car.id, now);
    const lot = !!t && isInLot(t.position, settings.homeLot);
    return { car, next, lot, out: !lot, open: t?.lockState === 'unlocked', needs: needsYou(t, next, now, showGuest) };
  });
  const filterOptions: FilterOption<CarFilter>[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'needs', label: 'Needs you', count: rows.filter((r) => r.needs).length, tone: 'warn' },
    { key: 'lot', label: 'In lot', count: rows.filter((r) => r.lot).length },
    { key: 'out', label: 'Out', count: rows.filter((r) => r.out).length },
    { key: 'unlocked', label: 'Unlocked', count: rows.filter((r) => r.open).length, tone: 'warn' },
  ];
  const shown = rows
    .filter((r) => (filter === 'all' ? true : filter === 'needs' ? r.needs : filter === 'lot' ? r.lot : filter === 'out' ? r.out : r.open))
    .filter((r) => matchesQuery(query, carName(r.car), r.car.make, r.car.model, r.car.year, r.car.plate, showGuest ? r.next?.guestFirstName : null))
    // Cars that need you first, then unlocked ones, then by name.
    .sort((a, b) => Number(b.needs) - Number(a.needs) || Number(b.open) - Number(a.open) || carName(a.car).localeCompare(carName(b.car)));

  const lockAll = async () => {
    setLockingAll(true);
    await Promise.all(unlocked.map((c) => lockCar(c.id)));
    setLockingAll(false);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* The purple band continues from the switch above, behind the locomotive (Light only). */}
        {band ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          />
        ) : null}

        <PopIn>
          <Locomotive
            total={cars.length}
            unlocked={unlocked.length}
            inLot={inLot.length}
            driving={driving.length}
            away={Math.max(0, away)}
            busy={lockingAll}
            onLockAll={lockAll}
          />
        </PopIn>

        <View style={{ gap: 10, marginTop: 16, marginBottom: 6 }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Search cars, plates or guests" />
          <FilterChips options={filterOptions} value={filter} onChange={setFilter} />
        </View>

        <View style={{ gap: 12, marginTop: 8 }}>
          {shown.map(({ car, next }, i) => (
            <PopIn key={car.id} delay={Math.min(i + 1, 6) * 60}>
              <Carriage car={car} now={now} showGuest={showGuest} next={next} onLock={() => lockCar(car.id)} onUnlock={() => setUnlocking(car.id)} />
            </PopIn>
          ))}
        </View>
        {!shown.length && cars.length ? (
          <NoMatches
            what="cars"
            onClear={() => {
              setQuery('');
              setFilter('all');
            }}
          />
        ) : null}

        <Muted style={{ fontSize: 12, textAlign: 'center', marginTop: 16 }}>Pretend data until Smartcar & Zubie are connected. Pull down to refresh.</Muted>
      </ScrollView>
      <UnlockPrompt carId={unlocking} onClose={() => setUnlocking(null)} />
    </>
  );
}

/** Lead engine: the logo's gradient, a cab with gold windows, big drive wheels. */
function Locomotive({
  total,
  unlocked,
  inLot,
  driving,
  away,
  busy,
  onLockAll,
}: {
  total: number;
  unlocked: number;
  inLot: number;
  driving: number;
  away: number;
  busy: boolean;
  onLockAll: () => void;
}) {
  const allLocked = unlocked === 0;
  return (
    <View style={{ paddingBottom: 16, marginTop: 12 }}>
      {/* cab */}
      <View
        style={{
          position: 'absolute',
          top: -13,
          right: 22,
          width: 96,
          height: 26,
          borderTopLeftRadius: 13,
          borderTopRightRadius: 13,
          overflow: 'hidden',
          flexDirection: 'row',
          gap: 7,
          paddingHorizontal: 13,
          paddingTop: 6,
          backgroundColor: LOGO.to,
        }}
      >
        <LogoGradient />
        <View style={{ flex: 1, height: 9, borderRadius: 3, backgroundColor: LOGO.gold }} />
        <View style={{ flex: 1, height: 9, borderRadius: 3, backgroundColor: LOGO.gold }} />
      </View>
      <View
        style={[
          {
            borderTopLeftRadius: 26,
            borderTopRightRadius: 18,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            overflow: 'hidden',
            padding: 16,
            gap: 12,
            backgroundColor: LOGO.to,
          },
          shadow(0.25),
        ]}
      >
        <LogoGradient />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: LOGO.gold }}>YOUR FLEET</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: allLocked ? '#FFFFFF' : '#FFD39A' }}>{allLocked ? `All ${total} locked` : `${unlocked} unlocked`}</Text>
          </View>
          <Bouncy
            onPress={onLockAll}
            disabled={allLocked || busy}
            accessibilityRole="button"
            accessibilityLabel={allLocked ? 'All cars locked' : `Lock all ${unlocked} unlocked cars`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 42,
              paddingHorizontal: 14,
              borderRadius: isGlass() ? 999 : 12,
              backgroundColor: allLocked ? 'rgba(255,255,255,0.14)' : LOGO.gold,
            }}
          >
            {busy ? (
              <ActivityIndicator color={LOGO.to} />
            ) : (
              <Ionicons name={allLocked ? 'checkmark-circle' : 'lock-closed'} size={16} color={allLocked ? '#BFF0CF' : LOGO.to} />
            )}
            <Text style={{ fontSize: 14, fontWeight: '800', color: allLocked ? '#FFFFFF' : LOGO.to }}>{allLocked ? 'All locked' : 'Lock all'}</Text>
          </Bouncy>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <LocoChip label={`${inLot} in lot`} />
          <LocoChip label={`${driving} driving`} />
          <LocoChip label={`${away} away`} />
        </View>
      </View>
      <Track />
      <Wheels side="left" count={3} size={18} />
      <Wheels side="right" count={2} size={14} />
    </View>
  );
}

function LocoChip({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#E6DCFA' }}>{label}</Text>
    </View>
  );
}

/** One car as a train carriage. */
function Carriage({
  car,
  now,
  showGuest,
  next,
  onLock,
  onUnlock,
}: {
  car: Car;
  now: Date;
  showGuest: boolean;
  next: Booking | undefined;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const { telemetry, settings, busyCars, currentUser } = useStore();
  const ref = useRef<HostInstance>(null);
  const expand = useExpand();
  const t = telemetry[car.id];
  const busy = busyCars[car.id];
  const isUnlocked = t?.lockState === 'unlocked';
  const inLot = t ? isInLot(t.position, settings.homeLot) : false;
  const allowedUnlock = canUnlockCar(currentUser, car.id, settings);
  const lotCenter = polygonCenter(settings.homeLot.polygon);

  const where = !t
    ? 'No location yet'
    : t.moving
      ? `Driving · ${formatDistance(distanceMeters(t.position, lotCenter))} from lot`
      : inLot
        ? `In ${settings.homeLot.name}`
        : `${formatDistance(distanceMeters(t.position, lotCenter))} from lot · parked ${fmtAgo(t.parkedSince, now)}`;
  const lockText = isUnlocked ? 'Unlocked' : t?.lockState === 'locked' ? 'Locked' : 'Lock unknown';

  // What's next for this car, and whether it needs you.
  let nextText = 'No trips booked';
  let nextColor = colors.muted;
  let needsYou = isUnlocked;
  if (next) {
    const onTrip = Date.parse(next.tripStart) <= now.getTime();
    const who = showGuest ? next.guestFirstName : null;
    if (onTrip) nextText = `${who ? `${who} on trip` : 'On a trip'} · back ${when(next.tripEnd, now)}`;
    else {
      const linkMissing = showGuest && next.checkIn.state === 'waiting' && !next.linkSentAt && Date.parse(next.tripStart) - now.getTime() < 24 * 3600_000;
      nextText = `${who ? `${who} picks up` : 'Pickup'} ${when(next.tripStart, now)}${linkMissing ? ' · link not sent' : ''}`;
      if (linkMissing) {
        nextColor = colors.unlocked;
        needsYou = true;
      }
    }
  }

  const open = () => expand(ref.current, () => router.push(`/car/${car.id}`), { radius: 18 });

  return (
    <View style={{ paddingBottom: 16 }}>
      <Bouncy onPress={open} accessibilityRole="button" accessibilityLabel={`${carName(car)}. ${where}. ${lockText}. ${nextText}.`}>
        <View
          ref={ref}
          style={[
            {
              backgroundColor: colors.card,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              borderWidth: needsYou ? 1.5 : 1,
              borderColor: needsYou ? LOGO.gold : colors.border,
              paddingTop: 19,
              paddingBottom: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            },
            glassFx(),
            shadow(0.1),
          ]}
        >
          {/* window strip */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 7, left: 14, right: 14, flexDirection: 'row', gap: 5 }}>
            {[0, 1, 2, 3, 4, 5].map((w) => (
              <View key={w} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.neutralBg }} />
            ))}
          </View>
          <View style={{ width: 10, height: 36, borderRadius: 4, backgroundColor: car.color ?? colors.muted }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>
              {carName(car)}
            </Text>
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: isUnlocked ? colors.unlocked : t?.moving ? colors.primary : inLot ? colors.locked : colors.muted }}
              numberOfLines={1}
            >
              {where} · {lockText}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: nextColor === colors.muted ? '500' : '700', color: nextColor }} numberOfLines={1}>
              {nextText}
            </Text>
          </View>
          <LockButton unlocked={isUnlocked} busy={busy} allowedUnlock={allowedUnlock} onLock={onLock} onUnlock={onUnlock} carLabel={carName(car)} />
        </View>
      </Bouncy>
      <Track />
      <Wheels side="left" count={2} size={13} />
      <Wheels side="right" count={2} size={13} />
    </View>
  );
}

/** Round button: Lock when the car is unlocked; Unlock (asks for your PIN) when it's locked. */
function LockButton({
  unlocked,
  busy,
  allowedUnlock,
  onLock,
  onUnlock,
  carLabel,
}: {
  unlocked: boolean;
  busy: 'locking' | 'unlocking' | undefined;
  allowedUnlock: boolean;
  onLock: () => void;
  onUnlock: () => void;
  carLabel: string;
}) {
  const disabled = !!busy || (!unlocked && !allowedUnlock);
  // Unlocked car → an orange "lock it" button; locked car → the solid Unlock button.
  const bg = unlocked ? colors.unlockedBg : allowedUnlock ? colors.primary : colors.neutralBg;
  const fg = unlocked ? colors.unlocked : allowedUnlock ? colors.primaryText : colors.muted;
  return (
    <Pressable
      onPress={unlocked ? onLock : onUnlock}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={unlocked ? `Lock ${carLabel}` : allowedUnlock ? `Unlock ${carLabel}` : `${carLabel} isn't assigned to you`}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, borderWidth: unlocked ? 2 : 0, borderColor: colors.unlocked, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Ionicons name={unlocked ? 'lock-closed' : 'lock-open'} size={19} color={fg} />}
    </Pressable>
  );
}

/** A pair (or trio) of wheels peeking out under a carriage. */
function Wheels({ side, count, size }: { side: 'left' | 'right'; count: number; size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 6, [side]: 28, flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.round(size / 4.5),
            borderColor: colors.secondary,
            backgroundColor: colors.bg === 'transparent' ? 'rgba(255,255,255,0.5)' : colors.bg,
          }}
        />
      ))}
    </View>
  );
}

/** The short stretch of track each carriage sits on: a rail with crossties under it. */
function Track() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -6, right: -6, bottom: 0, height: 8 }}>
      <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.secondary }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 1 }}>
        {Array.from({ length: 26 }).map((_, i) => (
          <View key={i} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: colors.secondary, opacity: 0.35 }} />
        ))}
      </View>
    </View>
  );
}

type CarFilter = 'all' | 'needs' | 'lot' | 'out' | 'unlocked';

/** A car needs you when it's unlocked, or a pickup within a day still has no check-in link. */
function needsYou(t: CarTelemetry | undefined, next: Booking | undefined, now: Date, showGuest: boolean) {
  if (t?.lockState === 'unlocked') return true;
  if (!next || !showGuest || Date.parse(next.tripStart) <= now.getTime()) return false;
  return next.checkIn.state === 'waiting' && !next.linkSentAt && Date.parse(next.tripStart) - now.getTime() < 24 * 3600_000;
}

/** Short time for a carriage line: "1:38 PM", "tomorrow 10:00 AM", "Thu 10:15 AM". */
function when(iso: string, now: Date) {
  const d = new Date(iso);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return fmtClock(iso);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${fmtClock(iso)}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${fmtClock(iso)}`;
}

function shadow(opacity: number): ViewStyle {
  if (isGlass()) return {};
  return { shadowColor: '#1E0E45', shadowOpacity: opacity, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 };
}
