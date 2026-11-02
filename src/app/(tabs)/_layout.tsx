import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useStore } from '../../state/AppStore';
import { colors, type IconName } from '../../ui/components';

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { currentUser } = useStore();
  const isExec = currentUser?.role === 'executive';
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}>
      <Tabs.Screen name="index" options={{ title: 'Cars', tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="bookings" options={{ title: isExec ? 'Bookings' : 'Trips', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="hours" options={{ title: 'Hours', tabBarIcon: icon('time') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
