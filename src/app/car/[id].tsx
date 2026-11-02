import { Stack, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type HostInstance } from 'react-native';
import { bookingStatus } from '../../logic/bookings';
import { distanceMeters, formatDistance, isInLot, polygonCenter } from '../../logic/geo';
import { can, canUnlockCar } from '../../logic/permissions';
import type { CarTelemetry, Geofence, Trip } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import { glassFx, isGlass, PopIn } from '../../ui/bubble';
import { TicketStack } from '../../ui/BookingsList';
import { BIG_CARRIAGE, useCarriageMorph } from '../../ui/CarriageMorph';
import { Track } from '../../ui/Engine';
import { Button, Card, colors, fmtClock, LockChip, Muted, Row, Screen, SectionTitle } from '../../ui/components';
import { LOGO } from '../../ui/logoColors';
import { getAppearance, theme } from '../../ui/theme';
import { fmtDay } from '../../ui/ticket';
import { UnlockPrompt } from '../../ui/UnlockPrompt';

const TRIPS_SHOWN = 3;

/**
 * One car (layout 2A): the carriage from the Cars tab, big, with the key facts in its windows,
 * then Lock / Unlock, the coming-up bookings as a ticket stack, and the trip history.
 */
export default function CarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, telemetry, settings, bookings, busyCars, currentUser, lockCar, getTrips, simulateDriveOff, simulateReturn } = useStore();
  const now = useNow(30_000);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const carriage = useRef<HostInstance>(null);
  const { land, canFlyBack, flyBack } = useCarriageMorph();
  const navigation = useNavigation();
  const car = cars.find((c) => c.id === id);
  const t = id ? telemetry[id] : undefined;

  // Going back to the Cars tab: the carriage shrinks back into its spot in the list. Armed once this
  // page's carriage is the one the list carriage grew into.
  const [flyHome, setFlyHome] = useState(false);
  usePreventRemove(flyHome, ({ data }) => {
    setFlyHome(false);
    const leave = () => setTimeout(() => navigation.dispatch(data.action), 0);
    if (data.action.type === 'GO_BACK' || data.action.type === 'POP') flyBack(carriage.current, leave);
    else leave();
  });

  useEffect(() => {
    if (id) getTrips(id).then(setTrips);
  }, [id, getTrips, t]);

  if (!car) return <Screen><Muted>Car not found.</Muted></Screen>;
  const busy = busyCars[car.id];
  const isExec = currentUser?.role === 'executive';
  const showGuest = can(currentUser, 'viewGuestDetails');
  const showMoney = can(currentUser, 'viewEarnings');
  const comingUp = bookings
    .filter((b) => b.carId === car.id && ['upcoming', 'active'].includes(bookingStatus(b, now)))
    .sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));
  const shownTrips = allTrips ? trips : trips.slice(0, TRIPS_SHOWN);

  const plate = car.plate?.trim();
  const title = plate || `${car.make} ${car.model}`;
  const subtitle = plate ? carName(car) : `${carName(car)} · no plate yet`;
  const windows = carWindows(t, settings.homeLot, now);

  // Purple band behind the carriage in Light, like the booking page.
  const band = getAppearance() === 'light' ? theme.primary : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: plate || carName(car) }} />
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, backgroundColor: band, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      {/* ---------- The carriage (the Cars tab carriage grows into this) ---------- */}
      <View style={{ paddingBottom: 12 }}>
        <View
          ref={carriage}
          onLayout={() => {
            land(carriage.current);
            setFlyHome(canFlyBack(carriage.current));
          }}
          accessible
          accessibilityLabel={`${plate ? `Plate ${plate}, ` : ''}${carName(car)}. ${windows.map((w) => `${w.label} ${w.value}`).join(', ')}.`}
          style={[
            {
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: BIG_CARRIAGE.pad,
              gap: 12,
            },
            glassFx(),
            isGlass() ? {} : { shadowColor: '#1E0E45', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
          ]}
        >
          <View style={{ flexDirection: 'row', gap: BIG_CARRIAGE.windowGap }}>
            {windows.map((w) => (
              <View
                key={w.label}
                style={{
                  flex: 1,
                  height: BIG_CARRIAGE.windowH,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: LOGO.gold,
                  backgroundColor: colors.neutralBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: colors.muted }}>{w.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: w.warn ? colors.unlocked : colors.text, marginTop: 1 }} numberOfLines={1}>
                  {w.value}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: BIG_CARRIAGE.plateSize, fontWeight: '800', letterSpacing: plate ? 2 : 0, color: colors.text }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <LockChip state={t?.lockState} />
          </View>
        </View>
        <Track />
      </View>

      <PopIn delay={60}>
        <Row>
          <Button style={{ flex: 1 }} variant="secondary" icon="lock-closed" label="Lock" busy={busy === 'locking'} disabled={!!busy} onPress={() => lockCar(car.id)} />
          <Button
            style={{ flex: 1 }}
            icon="lock-open"
            label="Unlock"
            busy={busy === 'unlocking'}
            disabled={!!busy || !canUnlockCar(currentUser, car.id, settings)}
            onPress={() => setUnlocking(true)}
          />
        </Row>
      </PopIn>

      {/* ---------- Coming up ---------- */}
      <SectionTitle>{comingUp.length ? `Coming up · ${comingUp.length}` : 'Coming up'}</SectionTitle>
      {comingUp.length ? (
        <TicketStack list={comingUp} now={now} showMoney={showMoney} showGuest={showGuest} carLabel={() => carName(car)} />
      ) : (
        <Muted>No bookings for this car.</Muted>
      )}

      {/* ---------- Trip history ---------- */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <SectionTitle>Trip history</SectionTitle>
        {trips.length > TRIPS_SHOWN ? (
          <Pressable onPress={() => setAllTrips((v) => !v)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>{allTrips ? 'Show less' : `See all ${trips.length}`}</Text>
          </Pressable>
        ) : null}
      </Row>
      {trips.length ? (
        <Card style={{ paddingVertical: 2, gap: 0 }}>
          {shownTrips.map((trip, i) => (
            <View
              key={trip.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{fmtDay(trip.departedAt)}</Text>
                <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>
                  {tripTimes(trip)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                  {trip.fromLabel} → {trip.toLabel}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{trip.distanceMi} mi</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {trip.stops} {trip.stops === 1 ? 'stop' : 'stops'}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Muted>No trips yet.</Muted>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14 }}>
        <Linked name="Smartcar" on={!!car.smartcarVehicleId} />
        <Linked name="Zubie" on={!!car.zubieDeviceId} />
      </View>

      {isExec ? (
        <>
          <SectionTitle>Test with pretend data</SectionTitle>
          <Card>
            <Muted>Simulates what Zubie will report, so you can see auto-lock and alerts work. Goes away once Zubie is connected.</Muted>
            <Button variant="secondary" icon="navigate" label="Simulate: car drives off" onPress={() => simulateDriveOff(car.id)} />
            <Button
              variant="secondary"
              icon="return-down-back"
              label="Simulate: parked in lot, left unlocked"
              onPress={() => simulateReturn(car.id, true)}
            />
            <Muted>Auto-lock fires after {settings.autoLockParkedMinutes} min parked unlocked in the lot.</Muted>
          </Card>
        </>
      ) : null}
      <UnlockPrompt carId={unlocking ? car.id : null} onClose={() => setUnlocking(false)} />
    </Screen>
  );
}

function Linked({ name, on }: { name: string; on: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? colors.locked : colors.muted }} />
      <Text style={{ fontSize: 12, color: colors.muted }}>{on ? `${name} connected` : `${name} not linked yet`}</Text>
    </View>
  );
}

/** The four info windows: where it is, parked/driving, last opened, last location fix. */
function carWindows(t: CarTelemetry | undefined, lot: Geofence, now: Date) {
  if (!t) {
    return [
      { label: 'WHERE', value: '—', warn: false },
      { label: 'PARKED', value: '—', warn: false },
      { label: 'OPENED', value: '—', warn: false },
      { label: 'GPS', value: '—', warn: false },
    ];
  }
  const where = isInLot(t.position, lot) ? 'Lot' : formatDistance(distanceMeters(t.position, polygonCenter(lot.polygon)));
  const status = t.moving ? { label: 'NOW', value: 'Driving' } : t.engineOn ? { label: 'NOW', value: 'Engine on' } : { label: 'PARKED', value: shortAgo(t.parkedSince, now) };
  return [
    { label: 'WHERE', value: where, warn: false },
    { ...status, warn: false },
    { label: 'OPENED', value: shortAgo(t.lastUnlockedAt, now), warn: t.lockState === 'unlocked' },
    { label: 'GPS', value: shortAgo(t.updatedAt, now), warn: false },
  ];
}

/** "1:54 PM → 6:10 PM", or "1:54 PM → Mon 2:54 PM" when it came back another day. */
function tripTimes(trip: Trip) {
  if (!trip.arrivedAt) return `${fmtClock(trip.departedAt)} → still out`;
  const sameDay = new Date(trip.departedAt).toDateString() === new Date(trip.arrivedAt).toDateString();
  const back = sameDay ? fmtClock(trip.arrivedAt) : `${new Date(trip.arrivedAt).toLocaleDateString(undefined, { weekday: 'short' })} ${fmtClock(trip.arrivedAt)}`;
  return `${fmtClock(trip.departedAt)} → ${back}`;
}

/** "now", "12m", "3h", "2d": short enough for a carriage window. */
function shortAgo(iso: string | null | undefined, now: Date) {
  if (!iso) return '—';
  const m = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
