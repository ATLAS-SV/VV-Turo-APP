import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../../state/AppStore';
import { BookingsList } from '../../ui/BookingsList';
import { CarsList } from '../../ui/CarsList';
import { colors } from '../../ui/components';
import { getAppearance } from '../../ui/theme';
import { SlideOnChange } from '../../ui/motion';

/** Cars and Bookings in one tab, with a switch at the top. Open bookings directly with /cars?view=bookings. */
export default function CarsAndBookings() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const { currentUser } = useStore();
  const showBookings = view === 'bookings';
  const bookingsLabel = currentUser?.role === 'executive' ? 'Bookings' : 'Trips';

  // Light: the switch sits on the purple band (the Cars list continues the band behind its locomotive).
  const band = getAppearance() === 'light';

  const segment = (label: string, active: boolean, to: 'cars' | 'bookings') => (
    <Pressable
      onPress={() => router.setParams({ view: to })}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: active ? (band ? '#FFFFFF' : colors.card) : 'transparent' }}
    >
      <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? colors.primary : band ? '#E6DCFA' : colors.muted }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: band && showBookings ? 14 : 0,
          backgroundColor: band ? colors.primary : 'transparent',
          borderBottomLeftRadius: band && showBookings ? 28 : 0,
          borderBottomRightRadius: band && showBookings ? 28 : 0,
          zIndex: 1,
        }}
      >
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', backgroundColor: band ? 'rgba(255,255,255,0.14)' : colors.neutralBg, borderRadius: 12, padding: 3 }}
        >
          {segment('Cars', !showBookings, 'cars')}
          {segment(bookingsLabel, showBookings, 'bookings')}
        </View>
      </View>
      {/* Bookings sits to the right of Cars: switching slides the list in from that side. */}
      <SlideOnChange value={showBookings ? 'b-bookings' : 'a-cars'} style={{ flex: 1 }} distance={48}>
        {showBookings ? <BookingsList /> : <CarsList />}
      </SlideOnChange>
    </View>
  );
}
