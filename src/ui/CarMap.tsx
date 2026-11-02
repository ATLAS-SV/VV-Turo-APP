import MapView, { Marker, Polygon } from 'react-native-maps';
import { polygonCenter } from '../logic/geo';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import type { CarMapProps } from './CarMap.types';

export default function CarMap({ selectedCarId, onSelectCar }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const center = polygonCenter(settings.homeLot.polygon);
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{ ...center, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
      showsTraffic={false}
    >
      <Polygon
        coordinates={settings.homeLot.polygon}
        strokeColor={colors.primary}
        fillColor="rgba(29,78,216,0.15)"
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
