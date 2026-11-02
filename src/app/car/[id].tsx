import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { bookingStatus } from '../../logic/bookings';
import { isInLot } from '../../logic/geo';
import { can, canUnlockCar } from '../../logic/permissions';
import type { Trip } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Button, Card, fmtAgo, fmtTime, KeyValue, LockChip, Muted, Row, Screen, SectionTitle, Title } from '../../ui/components';
import { UnlockPrompt } from '../../ui/UnlockPrompt';

export default function CarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, telemetry, settings, bookings, busyCars, currentUser, lockCar, getTrips, simulateDriveOff, simulateReturn } = useStore();
  const now = useNow(30_000);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [unlocking, setUnlocking] = useState(false);
  const car = cars.find((c) => c.id === id);
  const t = id ? telemetry[id] : undefined;

  useEffect(() => {
    if (id) getTrips(id).then(setTrips);
  }, [id, getTrips, t]);

  if (!car) return <Screen><Muted>Car not found.</Muted></Screen>;
  const busy = busyCars[car.id];
  const inLot = t ? isInLot(t.position, settings.homeLot) : false;
  const isExec = currentUser?.role === 'executive';
  const carBookings = bookings
    .filter((b) => b.carId === car.id && ['upcoming', 'active'].includes(bookingStatus(b, now)))
    .sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));

  return (
    <Screen>
      <Stack.Screen options={{ title: carName(car) }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Title>{carName(car)}</Title>
          <LockChip state={t?.lockState} />
        </Row>
        <KeyValue k="Where" v={inLot ? settings.homeLot.name : 'Away from home lot'} />
        <KeyValue k="Status" v={t?.moving ? 'Driving' : t?.engineOn ? 'Engine on' : `Parked ${fmtAgo(t?.parkedSince, now)}`} />
        <KeyValue k="Last unlocked" v={fmtAgo(t?.lastUnlockedAt, now)} />
        <KeyValue k="Location updated" v={fmtAgo(t?.updatedAt, now)} />
        <KeyValue k="Smartcar" v={car.smartcarVehicleId ? 'Connected' : 'Not connected (pretend)'} />
        <KeyValue k="Zubie" v={car.zubieDeviceId ? 'Connected' : 'Not connected (pretend)'} />
        <Row style={{ marginTop: 6 }}>
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
      </Card>

      {carBookings.length ? (
        <>
          <SectionTitle>Schedule</SectionTitle>
          <Card>
            {carBookings.map((b) => (
              <KeyValue key={b.id} k={can(currentUser, 'viewGuestDetails') ? b.guestFirstName : 'Trip'} v={`${fmtTime(b.tripStart)} → ${fmtTime(b.tripEnd)}`} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Trip history</SectionTitle>
      {trips.length ? (
        trips.map((trip) => (
          <Card key={trip.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title>{trip.distanceMi} mi</Title>
              <Muted>{trip.stops} stops</Muted>
            </Row>
            <KeyValue k={`Left · ${trip.fromLabel}`} v={fmtTime(trip.departedAt)} />
            <KeyValue k={`Back · ${trip.toLabel}`} v={trip.arrivedAt ? fmtTime(trip.arrivedAt) : 'Still out'} />
          </Card>
        ))
      ) : (
        <Muted>No trips yet.</Muted>
      )}

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
