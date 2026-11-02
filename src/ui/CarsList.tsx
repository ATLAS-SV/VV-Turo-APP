import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextBookingForCar } from '../logic/bookings';
import { distanceMeters, formatDistance, isInLot, polygonCenter } from '../logic/geo';
import { canUnlockCar } from '../logic/permissions';
import { carName, useNow, useStore } from '../state/AppStore';
import { Button, Card, Chip, colors, fmtAgo, fmtTime, LockChip, Muted, Row, Title } from './components';
import { UnlockPrompt } from './UnlockPrompt';

/** Every car on one screen with lock status. One-tap lock; unlock asks for your PIN. */
export function CarsList() {
  const store = useStore();
  const { cars, telemetry, settings, bookings, busyCars, currentUser, lockCar, refresh } = store;
  const now = useNow(30_000);
  const insets = useSafeAreaInsets();
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lotCenter = polygonCenter(settings.homeLot.polygon);

  const unlockedCount = cars.filter((c) => telemetry[c.id]?.lockState === 'unlocked').length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
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
        <Muted>
          {cars.length} cars · {unlockedCount ? `${unlockedCount} unlocked` : 'all locked'} · Pretend data until Smartcar & Zubie are connected
        </Muted>
        {cars.map((car) => {
          const t = telemetry[car.id];
          const busy = busyCars[car.id];
          const inLot = t ? isInLot(t.position, settings.homeLot) : false;
          const next = nextBookingForCar(bookings, car.id, now);
          const allowedUnlock = canUnlockCar(currentUser, car.id, settings);
          return (
            <Card key={car.id} onPress={() => router.push(`/car/${car.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={{ width: 10, height: 36, borderRadius: 3, backgroundColor: car.color ?? colors.muted }} />
                  <View style={{ flex: 1 }}>
                    <Title>{carName(car)}</Title>
                    <Muted>
                      {!t
                        ? 'No location yet'
                        : inLot
                          ? `In ${settings.homeLot.name}`
                          : `${formatDistance(distanceMeters(t.position, lotCenter))} from ${settings.homeLot.name}`}
                      {t ? ` · ${t.moving ? 'Driving' : `Parked ${fmtAgo(t.parkedSince, now)}`}` : ''}
                    </Muted>
                  </View>
                </Row>
                <LockChip state={t?.lockState} />
              </Row>
              {next ? (
                <Row>
                  <Chip
                    tone="info"
                    icon="calendar"
                    label={
                      Date.parse(next.tripStart) <= now.getTime()
                        ? `On trip until ${fmtTime(next.tripEnd)}`
                        : `Next pickup ${fmtTime(next.tripStart)}`
                    }
                  />
                </Row>
              ) : null}
              <Row>
                <Button
                  style={{ flex: 1 }}
                  variant="secondary"
                  icon="lock-closed"
                  label="Lock"
                  busy={busy === 'locking'}
                  disabled={!!busy}
                  onPress={() => lockCar(car.id)}
                />
                <Button
                  style={{ flex: 1 }}
                  icon="lock-open"
                  label={allowedUnlock ? 'Unlock' : 'Not assigned'}
                  busy={busy === 'unlocking'}
                  disabled={!!busy || !allowedUnlock}
                  onPress={() => setUnlocking(car.id)}
                />
              </Row>
            </Card>
          );
        })}
      </ScrollView>
      <UnlockPrompt carId={unlocking} onClose={() => setUnlocking(null)} />
    </>
  );
}
