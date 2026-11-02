// Web (home-screen app) map: OpenStreetMap via Leaflet. The native build uses CarMap.tsx (react-native-maps).
import 'leaflet/dist/leaflet.css';
import { Fragment, useEffect } from 'react';
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { isInLot, polygonCenter } from '../logic/geo';
import type { LatLng } from '../logic/types';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import { DOT, type CarMapProps } from './CarMap.types';

/** Cars are dots: purple, orange when unlocked, grey when parked away, a ring when driving, gold + halo when selected. */
export default function CarMap({ selectedCarId, onSelectCar, visibleCarIds, fitNonce }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const center = polygonCenter(settings.homeLot.polygon);
  const shown = cars.filter((c) => visibleCarIds.includes(c.id) && telemetry[c.id]);
  return (
    <div style={{ flex: 1, height: '100%', width: '100%' }}>
      <MapContainer center={[center.latitude, center.longitude]} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <Focus
          points={shown.map((c) => telemetry[c.id].position)}
          selected={selectedCarId ? telemetry[selectedCarId]?.position ?? null : null}
          nonce={fitNonce}
        />
        <Polygon
          positions={settings.homeLot.polygon.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{ color: colors.locked, weight: 2, dashArray: '6 5', fillOpacity: 0.1 }}
        />
        {shown.map((car) => {
          const t = telemetry[car.id];
          const pos: [number, number] = [t.position.latitude, t.position.longitude];
          const sel = car.id === selectedCarId;
          const away = !t.moving && !isInLot(t.position, settings.homeLot);
          const fill = sel ? DOT.selected : t.lockState === 'unlocked' ? DOT.unlocked : away ? DOT.away : DOT.car;
          return (
            <Fragment key={car.id}>
              {sel ? <CircleMarker center={pos} radius={20} interactive={false} pathOptions={{ stroke: false, fillColor: DOT.selected, fillOpacity: 0.25 }} /> : null}
              {t.moving && !sel ? <CircleMarker center={pos} radius={14} interactive={false} pathOptions={{ color: DOT.car, weight: 3, opacity: 0.3, fill: false }} /> : null}
              <CircleMarker
                center={pos}
                radius={sel ? 10 : away ? 7 : 8}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: fill, fillOpacity: 1 }}
                eventHandlers={{ click: () => onSelectCar(car.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {car.plate ? `${car.plate} · ` : ''}
                  {carName(car)}
                </Tooltip>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

/** Zoom to the selected car; with none selected, fit the visible cars on screen. */
function Focus({ points, selected, nonce }: { points: LatLng[]; selected: LatLng | null; nonce: number }) {
  const map = useMap();
  const key = selected ? `${selected.latitude},${selected.longitude}` : `${nonce}:` + points.map((p) => `${p.latitude},${p.longitude}`).join('|');
  useEffect(() => {
    if (selected) map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.6 });
    else if (points.length) map.flyToBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]), { padding: [56, 56], maxZoom: 14, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}
