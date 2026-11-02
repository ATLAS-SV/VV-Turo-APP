import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { bookingsOnDay, monthGrid } from '../logic/bookings';
import { addMonths, monthLabel } from '../logic/money';
import type { Booking, Car } from '../logic/types';
import { carName } from '../state/AppStore';
import { colors } from './components';
import { SlideOnChange } from './motion';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Month calendar: each day shows a bar per booked car, in that car's color. Tap a day to filter the list. */
export function BookingCalendar({
  bookings,
  cars,
  month,
  onMonth,
  selected,
  onSelect,
  now,
}: {
  bookings: Booking[];
  cars: Car[];
  month: string;
  onMonth: (m: string) => void;
  selected: Date | null;
  onSelect: (d: Date | null) => void;
  now: Date;
}) {
  const colorOf = (carId: string) => cars.find((c) => c.id === carId)?.color ?? colors.primary;
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => onMonth(addMonths(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{monthLabel(month)}</Text>
        <Pressable onPress={() => onMonth(addMonths(month, 1))} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.muted, fontWeight: '600' }}>
            {d}
          </Text>
        ))}
      </View>
      <SlideOnChange value={month}>
        {monthGrid(month).map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={{ flex: 1 }} />;
              const dayBookings = bookingsOnDay(bookings, day);
              const isSel = !!selected && sameDay(day, selected);
              const isToday = sameDay(day, now);
              return (
                <Pressable
                  key={di}
                  onPress={() => onSelect(isSel ? null : day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${day.toDateString()}: ${dayBookings.length ? dayBookings.map((b) => carName(cars.find((c) => c.id === b.carId))).join(', ') : 'no bookings'}`}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    margin: 1,
                    borderRadius: 8,
                    paddingTop: 3,
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: isSel ? colors.primary : 'transparent',
                    borderWidth: isToday && !isSel ? 1.5 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: isToday || isSel ? '800' : '500', color: isSel ? colors.primaryText : colors.text }}>{day.getDate()}</Text>
                  <View style={{ width: '80%', gap: 2 }}>
                    {dayBookings.slice(0, 3).map((b) => (
                      <View key={b.id} style={{ height: 4, borderRadius: 2, backgroundColor: isSel ? colors.primaryText : colorOf(b.carId) }} />
                    ))}
                    {dayBookings.length > 3 ? (
                      <Text style={{ fontSize: 9, textAlign: 'center', color: isSel ? colors.primaryText : colors.muted }}>+{dayBookings.length - 3}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </SlideOnChange>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, paddingTop: 4 }}>
        {cars.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: c.color ?? colors.primary }} />
            <Text style={{ fontSize: 11, color: colors.muted }}>{carName(c)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
