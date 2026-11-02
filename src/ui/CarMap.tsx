import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { isInLot, polygonCenter } from '../logic/geo';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import { DOT, type CarMapProps } from './CarMap.types';

/** Cars are dots: purple, orange when unlocked, grey when parked away, a ring when driving, gold + halo when selected. */
export default function CarMap({ selectedCarId, onSelectCar, visibleCarIds, fitNonce }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const center = polygonCenter(settings.homeLot.polygon);
  const mapRef = useRef<MapView>(null);
  const shown = cars.filter((c) => visibleCarIds.includes(c.id) && telemetry[c.id]);
  const sel = selectedCarId ? telemetry[selectedCarId]?.position : undefined;
  const all = shown.map((c) => telemetry[c.id].position);
  const key = sel ? `${sel.latitude},${sel.longitude}` : `${fitNonce}:` + all.map((p) => `${p.latitude},${p.longitude}`).join('|');
  // Zoom to the selected car; with none selected, fit the visible cars on screen.
  useEffect(() => {
    if (sel) mapRef.current?.animateToRegion({ ...sel, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    else if (all.length) mapRef.current?.fitToCoordinates(all, { edgePadding: { top: 70, right: 50, bottom: 70, left: 50 }, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ ...center, latitudeDelta: 0.15, longitudeDelta: 0.15 }} showsTraffic={false}>
      <Polygon coordinates={settings.homeLot.polygon} strokeColor={colors.locked} fillColor={colors.locked + '1A'} strokeWidth={2} lineDashPattern={[6, 5]} />
      {shown.map((car) => {
        const t = telemetry[car.id];
        const isSel = car.id === selectedCarId;
        const away = !t.moving && !isInLot(t.position, settings.homeLot);
        const fill = isSel ? DOT.selected : t.lockState === 'unlocked' ? DOT.unlocked : away ? DOT.away : DOT.car;
        const size = isSel ? 22 : away ? 14 : 16;
        return (
          <Marker
            key={car.id}
            coordinate={t.position}
            title={car.plate ?? carName(car)}
            description={carName(car)}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSelectCar(car.id)}
          >
            <View
              style={{
                width: isSel ? 44 : 30,
                height: isSel ? 44 : 30,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSel ? 'rgba(212,175,55,0.25)' : 'transparent',
                borderWidth: t.moving && !isSel ? 3 : 0,
                borderColor: 'rgba(59,31,122,0.3)',
              }}
            >
              <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fill, borderWidth: 3, borderColor: '#fff' }} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}
