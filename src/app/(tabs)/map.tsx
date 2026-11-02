import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Trip } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Button, Card, fmtAgo, fmtTime, LockChip, Muted, Row, Title } from '../../ui/components';
import CarMap from '../../ui/CarMap';

/** Map of all cars, plus the selected car's latest trip. */
export default function MapScreen() {
  const { cars, telemetry, getTrips } = useStore();
  const now = useNow(30_000);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastTrip, setLastTrip] = useState<Trip | null>(null);
  const car = cars.find((c) => c.id === selected);
  const t = selected ? telemetry[selected] : undefined;

  useEffect(() => {
    if (!selected) return;
    getTrips(selected).then((trips) => setLastTrip(trips[0] ?? null));
  }, [selected, getTrips, telemetry]);

  return (
    <View style={{ flex: 1 }}>
      <CarMap selectedCarId={selected} onSelectCar={setSelected} />
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        {car && t ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Title>{carName(car)}</Title>
              <LockChip state={t.lockState} />
            </Row>
            <Muted>
              {t.moving ? 'Driving now' : `Parked ${fmtAgo(t.parkedSince, now)}`} · updated {fmtAgo(t.updatedAt, now)}
            </Muted>
            {lastTrip ? (
              <Muted>
                Last trip: left {fmtTime(lastTrip.departedAt)}
                {lastTrip.arrivedAt ? ` · back ${fmtTime(lastTrip.arrivedAt)}` : ' · still out'} · {lastTrip.distanceMi} mi
              </Muted>
            ) : null}
            <Button variant="secondary" label="Trip history & controls" onPress={() => router.push(`/car/${car.id}`)} />
          </Card>
        ) : (
          <Card>
            <Muted>Tap a car to see where it is and its latest trip.</Muted>
          </Card>
        )}
      </View>
    </View>
  );
}
