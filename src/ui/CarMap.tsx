import { useEffect, useRef } from 'react';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { polygonCenter } from '../logic/geo';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import type { CarMapProps } from './CarMap.types';

export default function CarMap({ selectedCarId, onSelectCar }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const center = polygonCenter(settings.homeLot.polygon);
  const mapRef = useRef<MapView>(null);
  const sel = selectedCarId ? telemetry[selectedCarId]?.position : undefined;
  const all = cars.map((c) => telemetry[c.id]?.position).filter((p) => !!p);
  const key = sel ? `${sel.latitude},${sel.longitude}` : all.map((p) => `${p.latitude},${p.longitude}`).join('|');
  // Zoom to the selected car; with none selected, fit every car on screen.
  useEffect(() => {
    if (sel) mapRef.current?.animateToRegion({ ...sel, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    else if (all.length) mapRef.current?.fitToCoordinates(all, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={{ ...center, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
      showsTraffic={false}
    >
      <Polygon
        coordinates={settings.homeLot.polygon}
        strokeColor={colors.primary}
        fillColor={colors.primary + "26"}
        strokeWidth={2}
      />
      {cars.map((car) => {
        const t = telemetry[car.id];
        if (!t) return null;
        return (
          <Marker
            key={car.id}
            coordinate={t.position}
            title={carName(car)}
            description={`${t.lockState === 'locked' ? 'Locked' : 'Unlocked'} · ${t.moving ? 'Driving' : 'Parked'}`}
            pinColor={car.id === selectedCarId ? colors.primary : t.lockState === 'unlocked' ? 'orange' : 'green'}
            onPress={() => onSelectCar(car.id)}
          />
        );
      })}
    </MapView>
  );
}
