import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View, type HostInstance } from 'react-native';
import type { TaskWithState } from '../logic/tasks';
import type { Booking, Car } from '../logic/types';
import { carName, useStore } from '../state/AppStore';
import { PopAway } from './bubble';
import { colors, fmtAgo, fmtClock, fmtTime } from './components';
import { useExpand } from './expandContext';
import { theme } from './theme';

export function dueLabel(t: TaskWithState, now: Date) {
  if (t.doneAt) return `Done ${fmtAgo(t.doneAt, now)}${t.doneBy ? ` by ${t.doneBy}` : ''}`;
  const mins = Math.round((Date.parse(t.dueAt) - now.getTime()) / 60_000);
  if (mins < 0) return `Overdue · was due ${fmtTime(t.dueAt)}`;
  if (mins < 60) return `Due in ${mins} min`;
  return `Due ${fmtTime(t.dueAt)}`;
}

/** Short due time for the right edge of a row: "20 min", "8:30 PM", "Tue 10:00 AM", "was 2:00 PM". */
export function shortDue(t: TaskWithState, now: Date) {
  const d = new Date(t.dueAt);
  const sameDay = d.toDateString() === now.toDateString();
  const day = d.toLocaleDateString(undefined, { weekday: 'short' });
  const mins = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (mins < 0) return sameDay ? `was ${fmtClock(t.dueAt)}` : `was ${day}`;
  if (mins < 60) return `${mins} min`;
  return sameDay ? fmtClock(t.dueAt) : `${day} ${fmtClock(t.dueAt)}`;
}

/** "Maria · 2026 Genesis GV70" (the guest only for Executives). */
export function taskSubtitle(t: TaskWithState, bookings: Booking[], cars: Car[], showGuest: boolean) {
  const b = t.bookingId ? bookings.find((x) => x.id === t.bookingId) : undefined;
  return [showGuest && b ? b.guestFirstName : null, t.carId ? carName(cars.find((c) => c.id === t.carId)) : null].filter(Boolean).join(' · ');
}

/** Ring color of a task's tick circle: red when late, gold when due soon, lavender otherwise. */
export function taskRing(t: TaskWithState) {
  return t.status === 'overdue' ? colors.danger : t.status === 'due_soon' ? theme.accent : colors.secondary;
}

/**
 * Tick circle + task. Tapping the text opens the booking (Executives); tapping the circle marks it done.
 * With `vanish` (lists where a finished task moves elsewhere, like the Tasks page) the row lifts,
 * shows the tick, then shrinks away before it's marked done. `divider` draws a line under the row.
 */
export function TaskRow({ t, now, vanish = false, divider = false }: { t: TaskWithState; now: Date; vanish?: boolean; divider?: boolean }) {
  // Popping away from this done-state; once the change lands (doneAt differs) the row is back to normal.
  const [leavingFrom, setLeavingFrom] = useState<string | null | undefined>(undefined);
  const leaving = leavingFrom !== undefined && leavingFrom === (t.doneAt ?? null);
  const { completeTask, bookings, cars, currentUser } = useStore();
  const rowRef = useRef<HostInstance>(null);
  const expand = useExpand();
  const isExec = currentUser?.role === 'executive';
  const b = t.bookingId ? bookings.find((x) => x.id === t.bookingId) : undefined;
  // While popping away, show the circle already flipped.
  const done = !!t.doneAt !== leaving;
  const ring = taskRing(t);
  const tone = t.status === 'overdue' ? colors.danger : t.status === 'due_soon' ? colors.unlocked : colors.muted;
  const sub = taskSubtitle(t, bookings, cars, isExec);
  const openTo = isExec && b ? `/booking/${b.id}` : null;

  const toggle = () => {
    if (leaving) return;
    if (vanish) setLeavingFrom(t.doneAt ?? null);
    else completeTask(t.id, !t.doneAt);
  };

  return (
    <PopAway leaving={leaving} onGone={() => completeTask(t.id, !t.doneAt)}>
      <View
        ref={rowRef}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}
      >
        <Pressable
          onPress={toggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${t.title}${sub ? `, ${sub}` : ''}`}
          hitSlop={10}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: done ? 0 : 2,
            borderColor: ring,
            backgroundColor: done ? colors.locked : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}
        </Pressable>
        <Pressable
          style={{ flex: 1 }}
          disabled={!openTo}
          onPress={() => openTo && expand(rowRef.current, () => router.push(openTo as `/booking/${string}`), { radius: 8 })}
        >
          <Text style={{ fontSize: 15, color: done ? colors.muted : colors.text, textDecorationLine: done ? 'line-through' : 'none', fontWeight: done ? '600' : '700' }}>
            {t.title}
          </Text>
          {sub ? <Text style={{ fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
          {t.detail && !done ? <Text style={{ fontSize: 12, color: colors.muted }}>{t.detail}</Text> : null}
          {done ? <Text style={{ fontSize: 12, color: colors.muted }}>{dueLabel(t, now)}</Text> : null}
        </Pressable>
        {!done ? <Text style={{ fontSize: 12, fontWeight: '800', color: tone }}>{shortDue(t, now)}</Text> : null}
      </View>
    </PopAway>
  );
}
