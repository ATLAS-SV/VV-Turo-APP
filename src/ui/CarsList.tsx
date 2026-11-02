import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, type HostInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingStatus, nextBookingForCar } from '../logic/bookings';
import { isInLot } from '../logic/geo';
import { can, canUnlockCar } from '../logic/permissions';
import type { Booking, Car, CarTelemetry } from '../logic/types';
import { carName, useNow, useStore } from '../state/AppStore';
import { Bouncy, glassFx, isGlass, PopIn } from './bubble';
import { colors, fmtClock, Muted } from './components';
import { useCarriageMorph } from './CarriageMorph';
import { FilterChips, matchesQuery, NoMatches, SearchBar, type FilterOption } from './filters';
import LogoGradient from './LogoGradient';
import { LOGO } from './logoColors';
import { getAppearance } from './theme';
import { UnlockPrompt } from './UnlockPrompt';

/**
 * The fleet as a train (Cars tab, layout 1A): a locomotive in the logo's colors leads with the fleet
 * summary and Lock all, then one carriage per car (plate, make and model, trip) on its own stretch of track. Tap a carriage to open the car; its round button locks it (or unlocks with your PIN).
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

  // The locomotive (layout L1): lock status only counts for cars parked in the lot; cars on a trip
  // are the guest's to lock, so they're counted separately with when they're back.
  const trips = cars.flatMap((c) => {
    const b = bookings.find((x) => x.carId === c.id && bookingStatus(x, now) === 'active');
    return b ? [{ car: c, back: b.tripEnd }] : [];
  });
  const onTrip = new Set(trips.map((x) => x.car.id));
  const lotCars = cars.filter((c) => !onTrip.has(c.id) && telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot));
  const lotUnlocked = lotCars.filter((c) => telemetry[c.id]?.lockState === 'unlocked');
  const awayCars = cars.filter((c) => !onTrip.has(c.id) && telemetry[c.id] && !isInLot(telemetry[c.id].position, settings.homeLot));
  const leftUnlocked = cars.filter((c) => !onTrip.has(c.id) && telemetry[c.id]?.lockState === 'unlocked');
  const nextBack = trips.map((x) => x.back).sort()[0];
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

  const lockLot = async () => {
    setLockingAll(true);
    await Promise.all(lotUnlocked.map((c) => lockCar(c.id)));
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
            lot={lotCars.length}
            lotUnlocked={lotUnlocked.length}
            onTrip={trips.length}
            backLabel={nextBack ? `back ${shortWhen(nextBack, now)}` : ''}
            away={awayCars.length}
            leftUnlocked={leftUnlocked.length}
            busy={lockingAll}
            onLockLot={lockLot}
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

/**
 * Lead engine (layout L1): the logo's gradient and a cab with gold windows. Its headline is the lot:
 * how many cars are parked there and whether they're locked, with Lock lot cars. Under it: cars on a
 * trip (and when the first is back), cars away with no trip, and cars left unlocked anywhere off-trip.
 */
function Locomotive({
  lot,
  lotUnlocked,
  onTrip,
  backLabel,
  away,
  leftUnlocked,
  busy,
  onLockLot,
}: {
  lot: number;
  lotUnlocked: number;
  onTrip: number;
  backLabel: string;
  away: number;
  leftUnlocked: number;
  busy: boolean;
  onLockLot: () => void;
}) {
  const lotLocked = lotUnlocked === 0;
  const headline =
    lot === 0
      ? 'No cars parked'
      : lotLocked
        ? `${lot} parked · ${lot === 1 ? 'locked' : lot === 2 ? 'both locked' : 'all locked'}`
        : `${lotUnlocked} of ${lot} unlocked`;
  return (
    <View style={{ paddingBottom: 12, marginTop: 12 }}>
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
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: LOGO.gold }}>IN THE LOT</Text>
            <Text style={{ fontSize: 21, fontWeight: '800', color: lotLocked ? '#FFFFFF' : '#FFD39A' }}>{headline}</Text>
          </View>
          {lot > 0 && lotLocked ? (
            // Everything parked is locked: just a small check (the headline already says so).
            <View
              accessible
              accessibilityLabel="Cars in the lot are locked"
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="checkmark" size={20} color="#BFF0CF" />
            </View>
          ) : lot > 0 ? (
            <Bouncy
              onPress={onLockLot}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Lock the ${lotUnlocked} unlocked ${lotUnlocked === 1 ? 'car' : 'cars'} in the lot`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 42,
                paddingHorizontal: 14,
                borderRadius: isGlass() ? 999 : 12,
                backgroundColor: LOGO.gold,
              }}
            >
              {busy ? <ActivityIndicator color={LOGO.to} /> : <Ionicons name="lock-closed" size={16} color={LOGO.to} />}
              <Text style={{ fontSize: 14, fontWeight: '800', color: LOGO.to }}>Lock lot cars</Text>
            </Bouncy>
          ) : null}
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <LocoStat label="ON TRIP" value={onTrip ? `${onTrip}${backLabel ? ` · ${backLabel}` : ''}` : '0'} />
          <LocoStat label="AWAY" value={away ? `${away} · no trip` : '0'} />
          <LocoStat label="LEFT UNLOCKED" value={String(leftUnlocked)} warn={leftUnlocked > 0} />
        </View>
      </View>
      <Track />
    </View>
  );
}

function LocoStat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#D9CCF7' }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: warn ? '#FFD39A' : '#FFFFFF', marginTop: 1 }} numberOfLines={1}>
        {value}
      </Text>
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
  const { fly } = useCarriageMorph();
  const t = telemetry[car.id];
  const busy = busyCars[car.id];
  const isUnlocked = t?.lockState === 'unlocked';
  const allowedUnlock = canUnlockCar(currentUser, car.id, settings);
  const lockText = isUnlocked ? 'Unlocked' : t?.lockState === 'locked' ? 'Locked' : 'Lock unknown';
  // Main name is the plate; make and model sit smaller under it.
  const plate = car.plate?.trim();
  const title = plate || `${car.make} ${car.model}`;
  const subtitle = plate ? carName(car) : `${carName(car)} · no plate yet`;

  // The trip line: no bookings, on a trip, or the next trip.
  let tripText = 'No bookings';
  let tripColor = colors.muted;
  let needsYou = isUnlocked;
  if (next) {
    const onTrip = Date.parse(next.tripStart) <= now.getTime();
    const who = showGuest ? ` · ${next.guestFirstName}` : '';
    if (onTrip) {
      tripText = `On trip${who} · back ${when(next.tripEnd, now)}`;
      tripColor = colors.primary;
    } else {
      const linkMissing = showGuest && next.checkIn.state === 'waiting' && !next.linkSentAt && Date.parse(next.tripStart) - now.getTime() < 24 * 3600_000;
      tripText = `Next trip${who} · ${when(next.tripStart, now)}${linkMissing ? ' · link not sent' : ''}`;
      tripColor = linkMissing ? colors.unlocked : colors.text;
      needsYou = needsYou || linkMissing;
    }
  }

  // The carriage rides up and grows into the big carriage at the top of the car page.
  const open = () => fly(ref.current, { title, subtitle }, () => router.push(`/car/${car.id}`));

  return (
    <View style={{ paddingBottom: 12 }}>
      <Bouncy onPress={open} accessibilityRole="button" accessibilityLabel={`${plate ? `Plate ${plate}, ` : ''}${carName(car)}. ${lockText}. ${tripText}.`}>
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
            <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: plate ? 1.2 : 0, color: colors.text }} numberOfLines={1}>
              {title}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: tripColor, marginTop: 2 }} numberOfLines={2}>
              {tripText}
            </Text>
          </View>
          <LockButton unlocked={isUnlocked} busy={busy} allowedUnlock={allowedUnlock} onLock={onLock} onUnlock={onUnlock} carLabel={carName(car)} />
        </View>
      </Bouncy>
      <Track />
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

/** The short stretch of track each carriage sits on: a rail with crossties under it. */
export function Track() {
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

/** Very short "when" for the locomotive: "6:00 PM" today, else the weekday ("Tue"). */
function shortWhen(iso: string, now: Date) {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return fmtClock(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
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
