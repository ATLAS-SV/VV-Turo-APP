import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStore } from '../../state/AppStore';
import { BookingsList } from '../../ui/BookingsList';
import { CarsList } from '../../ui/CarsList';
import { colors } from '../../ui/components';
import { SlideOnChange } from '../../ui/motion';

/** Cars and Bookings in one tab, with a switch at the top. Open bookings directly with /cars?view=bookings. */
export default function CarsAndBookings() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const { currentUser } = useStore();
  const showBookings = view === 'bookings';
  const bookingsLabel = currentUser?.role === 'executive' ? 'Bookings' : 'Trips';

  const segment = (label: string, active: boolean, to: 'cars' | 'bookings') => (
    <Pressable
      onPress={() => router.setParams({ view: to })}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: active ? colors.card : 'transparent' }}
    >
      <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? colors.primary : colors.muted }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.neutralBg, borderRadius: 10, padding: 3 }}>
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
