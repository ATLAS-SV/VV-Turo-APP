// Web preview only: react-native-maps doesn't run in a browser, so draw a simple
// schematic of car positions relative to the home lot. The phone app uses CarMap.tsx.
import { Pressable, Text, View } from 'react-native';
import { isInLot, polygonCenter } from '../logic/geo';
import { carName, useStore } from '../state/AppStore';
import { colors } from './components';
import type { CarMapProps } from './CarMap.types';

export default function CarMap({ selectedCarId, onSelectCar }: CarMapProps) {
  const { cars, telemetry, settings } = useStore();
  const c = polygonCenter(settings.homeLot.polygon);
  const span = 0.18;
  const toXY = (lat: number, lng: number) => ({
    left: `${Math.min(95, Math.max(2, 50 + ((lng - c.longitude) / span) * 100))}%` as const,
    top: `${Math.min(92, Math.max(2, 50 - ((lat - c.latitude) / span) * 100))}%` as const,
  });
  return (
    <View style={{ flex: 1, backgroundColor: '#E8EEF4' }}>
      <View style={{ position: 'absolute', left: '46%', top: '46%', width: '8%', height: '8%', borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary + '1F', borderRadius: 4 }} />
      <Text style={{ position: 'absolute', left: '44%', top: '55%', color: colors.primary, fontSize: 12, fontWeight: '600' }}>{settings.homeLot.name}</Text>
      {cars.map((car, i) => {
        const t = telemetry[car.id];
        if (!t) return null;
        const inLot = isInLot(t.position, settings.homeLot);
        const pos = inLot ? { left: `${47 + (i % 2) * 3}%` as const, top: `${47 + Math.floor(i / 2) * 3}%` as const } : toXY(t.position.latitude, t.position.longitude);
        const sel = car.id === selectedCarId;
        return (
          <Pressable key={car.id} onPress={() => onSelectCar(car.id)} style={{ position: 'absolute', ...pos, alignItems: 'center' }}>
            <View style={{ width: sel ? 18 : 14, height: sel ? 18 : 14, borderRadius: 9, borderWidth: 2, borderColor: '#fff', backgroundColor: sel ? colors.primary : t.lockState === 'unlocked' ? colors.unlocked : colors.locked }} />
            {!inLot || sel ? <Text style={{ fontSize: 11, color: colors.text, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 3 }}>{carName(car)}</Text> : null}
          </Pressable>
        );
      })}
      <Text style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: colors.muted }}>Web preview: schematic map. The phone app shows a real map.</Text>
    </View>
  );
}
