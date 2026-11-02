import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { defaultHomePage, type HomePage } from '../../logic/types';
import { useStore } from '../../state/AppStore';
import { HeaderMark } from '../../ui/Brand';
import { colors, type IconName } from '../../ui/components';

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} size={size} color={color as string} />;
  }
  return TabIcon;
}

const HOME_HREF = { cars: '/', map: '/map', bookings: '/bookings', hours: '/hours' } as const;

export default function TabsLayout() {
  const { currentUser } = useStore();
  const isExec = currentUser?.role === 'executive';
  const home: HomePage = currentUser ? (currentUser.homePage ?? defaultHomePage(currentUser.role)) : 'cars';

  // This layout mounts fresh each time someone enters their PIN: open their designated page.
  useEffect(() => {
    if (home !== 'cars') router.navigate(HOME_HREF[home]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerLeft: HeaderMark }}>
      <Tabs.Screen name="index" options={{ title: 'Cars', tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="bookings" options={{ title: isExec ? 'Bookings' : 'Trips', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="hours" options={{ title: 'Hours', tabBarIcon: icon('time') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
