// Web (home-screen app) map: OpenStreetMap via Leaflet. The native build uses CarMap.tsx (react-native-maps).
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLng } from '../logic/types';
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
        <Focus points={cars.map((c) => telemetry[c.id]?.position).filter((p): p is LatLng => !!p)} selected={selectedCarId ? telemetry[selectedCarId]?.position ?? null : null} />
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

/** Zoom to the selected car; with none selected, fit every car (and the home lot) on screen. */
function Focus({ points, selected }: { points: LatLng[]; selected: LatLng | null }) {
  const map = useMap();
  const key = selected ? `${selected.latitude},${selected.longitude}` : points.map((p) => `${p.latitude},${p.longitude}`).join('|');
  useEffect(() => {
    if (selected) map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.6 });
    else if (points.length) map.flyToBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]), { padding: [36, 36], maxZoom: 14, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}
