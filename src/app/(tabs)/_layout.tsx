import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
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

/** The larger, raised Overview button in the middle of the tab bar. */
function OverviewTabButton(props: BottomTabBarButtonProps) {
  const selected = !!props.accessibilityState?.selected;
  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Overview"
      accessibilityState={{ selected }}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          marginTop: -22,
          backgroundColor: selected ? colors.primary : colors.primaryDark,
          borderWidth: 4,
          borderColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        <Ionicons name="grid" size={26} color={colors.accent} />
      </View>
      <Text style={{ fontSize: 11, marginTop: 1, fontWeight: '700', color: selected ? colors.primary : colors.muted }}>Overview</Text>
    </Pressable>
  );
}

const HOME_HREF = { overview: '/', cars: '/cars', map: '/map', bookings: '/bookings', money: '/money', hours: '/hours' } as const;

/**
 * Five buttons per role with Overview in the middle.
 * Executive: Cars · Bookings · Overview · Money · More (Map & Hours open from Overview and More).
 * Employee:  Cars · Map · Overview · Hours · More.
 */
export default function TabsLayout() {
  const { currentUser } = useStore();
  const isExec = currentUser?.role === 'executive';
  let home: HomePage = currentUser ? (currentUser.homePage ?? defaultHomePage(currentUser.role)) : 'overview';
  if (home === 'money' && !isExec) home = 'overview'; // Money is Executive-only

  // This layout mounts fresh each time someone enters their PIN: open their designated page.
  useEffect(() => {
    if (home !== 'overview') router.navigate(HOME_HREF[home]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide a tab's button but keep the page reachable (from Overview and More). `href: null` would make it unreachable.
  const hidden = { tabBarItemStyle: { display: 'none' as const } };
  const shown = (onTabBar: boolean) => (onTabBar ? {} : hidden);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerLeft: HeaderMark,
        tabBarStyle: { overflow: 'visible' },
      }}
    >
      <Tabs.Screen name="cars" options={{ title: 'Cars', tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map'), ...shown(!isExec) }} />
      <Tabs.Screen name="bookings" options={{ title: isExec ? 'Bookings' : 'Trips', tabBarIcon: icon('calendar'), ...shown(isExec) }} />
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarButton: OverviewTabButton }} />
      <Tabs.Screen name="money" options={{ title: 'Money', tabBarIcon: icon('cash'), ...shown(isExec) }} />
      <Tabs.Screen name="hours" options={{ title: 'Hours', tabBarIcon: icon('time'), ...shown(!isExec) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
