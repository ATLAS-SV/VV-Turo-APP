import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isInLot } from '../../logic/geo';
import { formatMinutes, minutesInRange, openShift, shiftMinutes, startOfWeek } from '../../logic/hours';
import { carAccessOf } from '../../logic/permissions';
import { carName, useNow, useStore } from '../../state/AppStore';
import { Bouncy, glassFx, isGlass, PopIn, radius } from '../../ui/bubble';
import { colors, fmtClock, Muted } from '../../ui/components';
import { Engine } from '../../ui/Engine';
import { LOGO } from '../../ui/logoColors';
import { getAppearance } from '../../ui/theme';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * My hours (layout M1): the engine is the time clock (live timer + one big Clock in/out), then this
 * week's hours by day, the cars you can unlock, and your recent shifts. Executives manage everyone's
 * hours on Team & hours instead.
 */
export default function HoursScreen() {
  const { currentUser, shifts, cars, telemetry, settings, toggleClock } = useStore();
  const now = useNow(15_000);
  const insets = useSafeAreaInsets();
  if (!currentUser) return null;
  const mine = shifts.filter((s) => s.userId === currentUser.id);
  const open = openShift(shifts, currentUser.id);
  const last = mine.filter((s) => s.clockOut).sort((a, b) => Date.parse(b.clockIn) - Date.parse(a.clockIn))[0];
  const weekStart = startOfWeek(now);
  const week = minutesInRange(mine, weekStart, now, now);
  const today = (now.getDay() + 6) % 7;
  const perDay = DAYS.map((_, i) => {
    const from = new Date(weekStart);
    from.setDate(from.getDate() + i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return i > today ? 0 : minutesInRange(mine, from, to < now ? to : now, now);
  });
  const maxDay = Math.max(60, ...perDay);
  const recent = [...mine].sort((a, b) => Date.parse(b.clockIn) - Date.parse(a.clockIn)).slice(0, 10);

  const isExec = currentUser.role === 'executive';
  const access = isExec ? 'all' : carAccessOf(currentUser, settings);
  const myCars = access === 'all' ? cars : cars.filter((c) => currentUser.assignedCarIds.includes(c.id));
  const others = cars.length - myCars.length;
  const band = getAppearance() === 'light';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: insets.bottom + 24, gap: 12 }}>
      {band ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 92, backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
        />
      ) : null}

      {/* The time clock */}
      <PopIn>
        <Engine>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: LOGO.gold }}>{open ? 'ON THE CLOCK' : 'OFF THE CLOCK'}</Text>
            <Text style={{ fontSize: 44, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>{open ? formatMinutes(shiftMinutes(open, now)) : '0m'}</Text>
            <Text style={{ fontSize: 13, color: '#D9CCF7' }}>
              {open ? `Since ${fmtClock(open.clockIn)}` : last ? `Last shift ended ${dayName(last.clockOut!, now)} ${fmtClock(last.clockOut!)}` : `Hi ${currentUser.name}, ready to start?`}
            </Text>
          </View>
          <Bouncy
            onPress={toggleClock}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Clock out' : 'Clock in'}
            style={{
              height: 52,
              borderRadius: isGlass() ? 999 : 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: open ? 'transparent' : LOGO.gold,
              borderWidth: open ? 1.5 : 0,
              borderColor: 'rgba(255,255,255,0.6)',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '800', color: open ? '#FFFFFF' : LOGO.to }}>{open ? 'Clock out' : 'Clock in'}</Text>
          </Bouncy>
        </Engine>
      </PopIn>

      {/* This week */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>THIS WEEK</Label>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{formatMinutes(week)}</Text>
      </View>
      <PopIn delay={60}>
        <View style={[cardStyle(), { padding: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96 }} accessibilityLabel={`This week by day: ${perDay.map((m, i) => `${DAYS[i]} ${formatMinutes(m)}`).join(', ')}`}>
            {perDay.map((m, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: i === today && open ? colors.unlocked : colors.muted }}>
                  {i === today && open ? 'now' : m ? `${Math.round((m / 60) * 10) / 10}h` : ''}
                </Text>
                <View
                  style={{
                    width: '100%',
                    height: m ? Math.max(6, (m / maxDay) * 60) : 4,
                    borderRadius: 6,
                    backgroundColor: i === today ? LOGO.gold : m ? colors.secondary : colors.neutralBg,
                  }}
                />
                <Text style={{ fontSize: 11, fontWeight: '800', color: i === today ? colors.primary : colors.muted }}>{DAYS[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      </PopIn>

      {/* The cars this person can unlock */}
      <Label>{access === 'all' ? `YOUR CARS · ALL ${cars.length}` : `YOUR CARS · ${myCars.length} OF ${cars.length}`}</Label>
      <PopIn delay={110}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {myCars.map((c) => {
            const t = telemetry[c.id];
            const where = t?.moving ? 'driving' : t && isInLot(t.position, settings.homeLot) ? 'in lot' : 'away';
            const unlocked = t?.lockState === 'unlocked';
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/car/${c.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${c.plate || carName(c)}, ${carName(c)}, ${where}${unlocked ? ', unlocked' : ''}`}
                style={({ pressed }) => [
                  {
                    width: '48%',
                    flexGrow: 1,
                    backgroundColor: colors.card,
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                    borderWidth: unlocked ? 1.5 : 1,
                    borderColor: unlocked ? colors.unlocked : colors.border,
                    paddingTop: 15,
                    paddingBottom: 10,
                    paddingHorizontal: 12,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                  glassFx(),
                ]}
              >
                <View pointerEvents="none" style={{ position: 'absolute', top: 6, left: 12, right: 12, flexDirection: 'row', gap: 4 }}>
                  {[0, 1, 2, 3].map((w) => (
                    <View key={w} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.neutralBg }} />
                  ))}
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: c.plate ? 1 : 0, color: colors.text }} numberOfLines={1}>
                  {c.plate?.trim() || `${c.make} ${c.model}`}
                </Text>
                <Text style={{ fontSize: 11, color: unlocked ? colors.unlocked : colors.muted, fontWeight: unlocked ? '700' : '400' }} numberOfLines={1}>
                  {c.make} {c.model} · {unlocked ? 'unlocked' : where}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PopIn>
      {!myCars.length ? <Muted>No cars assigned to you yet. Ask an executive to pick your cars.</Muted> : null}
      {myCars.length && others > 0 ? (
        <Muted style={{ fontSize: 12 }}>
          {others} other {others === 1 ? 'car isn’t' : 'cars aren’t'} assigned to you. You can still lock any car.
        </Muted>
      ) : null}

      {/* Recent shifts */}
      <Label>RECENT SHIFTS</Label>
      {recent.length ? (
        <View style={[cardStyle(), { paddingHorizontal: 14, paddingVertical: 2 }]}>
          {recent.map((s, i) => (
            <View
              key={s.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{dayName(s.clockIn, now)}</Text>
                <Text style={{ fontSize: 12, color: s.clockOut ? colors.muted : colors.locked, fontWeight: s.clockOut ? '400' : '700' }}>
                  {fmtClock(s.clockIn)} → {s.clockOut ? fmtClock(s.clockOut) : 'still on'}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{formatMinutes(shiftMinutes(s, now))}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Muted>No shifts yet. Tap Clock in when you start.</Muted>
      )}
    </ScrollView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.muted }}>{children}</Text>;
}

function cardStyle() {
  return [{ backgroundColor: colors.card, borderRadius: radius() + 2, borderWidth: 1, borderColor: colors.border }, glassFx()];
}

/** "Today", "Yesterday", or the weekday and date. */
function dayName(iso: string, now: Date) {
  const d = new Date(iso);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
