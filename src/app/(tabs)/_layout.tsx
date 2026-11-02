import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { defaultHomePage, type HomePage } from '../../logic/types';
import { useStore } from '../../state/AppStore';
import { HeaderMark } from '../../ui/Brand';
import { colors, type IconName } from '../../ui/components';
import { SwipeTabs } from '../../ui/motion';

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
          width: 56,
          height: 56,
          borderRadius: 28,
          marginTop: -24,
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
        <Ionicons name="grid" size={24} color={selected && colors.primary === colors.accent ? colors.primaryText : colors.accent} />
      </View>
      <Text style={{ fontSize: 10, marginTop: 0, fontWeight: '700', color: selected ? colors.primary : colors.muted }}>Overview</Text>
    </Pressable>
  );
}

const TAB_HREF = { cars: '/cars', map: '/map', index: '/', money: '/money', hours: '/hours', more: '/more' } as const;

const HOME_HREF = { overview: '/', cars: '/cars', map: '/map', bookings: '/cars?view=bookings', money: '/money', hours: '/hours' } as const;

/**
 * Five buttons per role with Overview in the middle.
 * Executive: Cars & Bookings · Map · Overview · Money · More (Hours and Activity log are in More).
 * Employee:  Cars & Trips · Map · Overview · Hours · More.
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

  // Swipe order matches the tab bar, left to right.
  const order = isExec ? ['cars', 'map', 'index', 'money', 'more'] : ['cars', 'map', 'index', 'hours', 'more'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerLeft: HeaderMark,
        tabBarStyle: { overflow: 'visible' },
        animation: 'shift', // tabs slide in from the side you're moving toward
      }}
      screenLayout={({ route, children }) => {
        const i = order.indexOf(route.name);
        return (
          <SwipeTabs
            prev={i > 0 ? order[i - 1] : null}
            next={i >= 0 && i < order.length - 1 ? order[i + 1] : null}
            onGo={(tab) => router.navigate(TAB_HREF[tab as keyof typeof TAB_HREF])}
            enabled={i >= 0} // the map itself and the car picker are no-swipe zones (see map.tsx)
          >
            {children}
          </SwipeTabs>
        );
      }}
    >
      <Tabs.Screen name="cars" options={{ title: isExec ? 'Cars & Bookings' : 'Cars & Trips', tabBarLabel: 'Cars', tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarButton: OverviewTabButton }} />
      <Tabs.Screen name="money" options={{ title: 'Money', tabBarIcon: icon('cash'), ...shown(isExec) }} />
      <Tabs.Screen name="hours" options={{ title: 'Hours', tabBarIcon: icon('time'), ...shown(!isExec) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
