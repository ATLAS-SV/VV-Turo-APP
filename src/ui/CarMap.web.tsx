// Web (home-screen app) map: OpenStreetMap via Leaflet. The native build uses CarMap.tsx (react-native-maps).
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import { polygonCenter } from '../logic/geo';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import type { CarMapProps } from './CarMap.types';

export default function CarMap({ selectedCarId, onSelectCar }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const center = polygonCenter(settings.homeLot.polygon);
  return (
    <div style={{ flex: 1, height: '100%', width: '100%' }}>
      <MapContainer center={[center.latitude, center.longitude]} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <Polygon
          positions={settings.homeLot.polygon.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{ color: colors.primary, weight: 2, fillOpacity: 0.15 }}
        />
        {cars.map((car) => {
          const t = telemetry[car.id];
          if (!t) return null;
          const sel = car.id === selectedCarId;
          const fill = t.lockState === 'unlocked' ? colors.unlocked : colors.locked;
          return (
            <CircleMarker
              key={car.id}
              center={[t.position.latitude, t.position.longitude]}
              radius={sel ? 11 : 8}
              pathOptions={{ color: sel ? colors.primary : '#ffffff', weight: 3, fillColor: fill, fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelectCar(car.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent={sel}>
                {carName(car)}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
