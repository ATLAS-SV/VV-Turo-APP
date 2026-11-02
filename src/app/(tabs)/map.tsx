import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { distanceMeters, formatDistance, isInLot, polygonCenter } from '../../logic/geo';
import type { Car, Trip } from '../../logic/types';
import { carName, useNow, useStore } from '../../state/AppStore';
import CarMap from '../../ui/CarMap';
import { Button, Card, colors, fmtAgo, fmtTime, KeyValue, LockChip, Muted, Row, SectionTitle, Title } from '../../ui/components';
import { NoSwipeZone, SlideOnChange } from '../../ui/motion';
import { Bouncy, glassFx, radius } from '../../ui/bubble';

/**
 * The map is the main focus at the top. Below it: a car picker (pick one to zoom to it and see its details),
 * then every car on the map as a list.
 */
export default function MapScreen() {
  const { cars, telemetry, settings } = useStore();
  const now = useNow(30_000);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const lot = polygonCenter(settings.homeLot.polygon);

  const where = (car: Car) => {
    const t = telemetry[car.id];
    if (!t) return 'No location yet';
    const place = isInLot(t.position, settings.homeLot) ? `In ${settings.homeLot.name}` : `${formatDistance(distanceMeters(t.position, lot))} from ${settings.homeLot.name}`;
    return `${place} · ${t.moving ? 'Driving' : `Parked ${fmtAgo(t.parkedSince, now)}`}`;
  };

  // Keep the selected car's button in view in the picker row.
  const chipRow = useRef<ScrollViewInstance>(null);
  const chipX = useRef<Record<string, number>>({});
  const pick = (carId: string | null, scrollUp = false) => {
    setSelected(carId);
    if (scrollUp) scroller.current?.scrollTo({ y: 0, animated: true });
    chipRow.current?.scrollTo({ x: Math.max(0, (chipX.current[carId ?? 'all'] ?? 0) - 16), animated: true });
  };

  const inLot = cars.filter((c) => telemetry[c.id] && isInLot(telemetry[c.id].position, settings.homeLot)).length;
  const driving = cars.filter((c) => telemetry[c.id]?.moving).length;

  return (
    <ScrollView ref={scroller} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* The map: main focus */}
      <View style={{ height: Math.max(300, Math.round(height * 0.5)) }}>
        <NoSwipeZone style={{ flex: 1 }}>
          <CarMap selectedCarId={selected} onSelectCar={(id) => pick(id)} />
        </NoSwipeZone>
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        {/* Car picker */}
        <NoSwipeZone>
        <ScrollView ref={chipRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
          <PickerChip label="All cars" active={!selected} onPress={() => pick(null)} onX={(x) => (chipX.current.all = x)} />
          {cars.map((c) => (
            <PickerChip
              key={c.id}
              onX={(x) => (chipX.current[c.id] = x)}
              label={`${c.make} ${c.model}`}
              dot={telemetry[c.id]?.lockState === 'unlocked' ? colors.unlocked : colors.locked}
              active={selected === c.id}
              onPress={() => pick(c.id)}
            />
          ))}
        </ScrollView>
        </NoSwipeZone>

        {/* Selected car, or a summary of all of them */}
        <SlideOnChange value={selected ?? '0-all'}>
          {selected ? (
            <SelectedCar car={cars.find((c) => c.id === selected)!} where={where} now={now} />
          ) : (
            <Card>
              <Title>{cars.length} cars</Title>
              <Row style={{ gap: 18 }}>
                <Stat n={inLot} label={`in ${settings.homeLot.name}`} />
                <Stat n={cars.length - inLot} label="out" />
                <Stat n={driving} label="driving" />
              </Row>
              <Muted style={{ fontSize: 13 }}>Pick a car above, or tap one on the map, to zoom in on it.</Muted>
            </Card>
          )}
        </SlideOnChange>

        {/* Every car on the map */}
        <SectionTitle>Cars on the map</SectionTitle>
        {cars.map((c) => {
          const t = telemetry[c.id];
          const active = selected === c.id;
          return (
            <Bouncy
              key={c.id}
              onPress={() => pick(c.id, true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${carName(c)} on the map`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
                borderRadius: radius(),
                backgroundColor: colors.card,
                borderWidth: active ? 2 : 1,
                borderColor: active ? colors.primary : colors.border,
                ...glassFx(),
              }}
            >
              <View style={{ width: 8, height: 34, borderRadius: 3, backgroundColor: c.color ?? colors.muted }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{carName(c)}</Text>
                <Muted style={{ fontSize: 13 }}>{where(c)}</Muted>
              </View>
              <LockChip state={t?.lockState} />
            </Bouncy>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SelectedCar({ car, where, now }: { car: Car; where: (c: Car) => string; now: Date }) {
  const { telemetry, getTrips } = useStore();
  const t = telemetry[car.id];
  const [lastTrip, setLastTrip] = useState<Trip | null>(null);
  useEffect(() => {
    getTrips(car.id).then((trips) => setLastTrip(trips[0] ?? null));
  }, [car.id, getTrips, t]);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>{carName(car)}</Title>
        <LockChip state={t?.lockState} />
      </Row>
      <Muted>{where(car)}</Muted>
      <KeyValue k="Location updated" v={fmtAgo(t?.updatedAt, now)} />
      {lastTrip ? (
        <KeyValue
          k="Last trip"
          v={`${fmtTime(lastTrip.departedAt)} → ${lastTrip.arrivedAt ? fmtTime(lastTrip.arrivedAt) : 'still out'} · ${lastTrip.distanceMi} mi`}
        />
      ) : null}
      <Button variant="secondary" icon="time" label="Trip history & controls" onPress={() => router.push(`/car/${car.id}`)} />
    </Card>
  );
}

function PickerChip({ label, active, onPress, dot, onX }: { label: string; active: boolean; onPress: () => void; dot?: string; onX: (x: number) => void }) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => onX(e.nativeEvent.layout.x)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, borderWidth: 1, borderColor: active ? colors.primaryText : 'transparent' }} /> : null}
      <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{n}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}
